from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import io
from typing import List, Dict
from PIL import Image, features
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Image Converter API" ,docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_supported_formats() -> Dict[str, List[str]]:
    """
    Returns a static map of the most commonly used and reliable image format conversions.
    These are the core formats that Pillow is known to handle well.
    """
    return {
        # JPEG - Universal support, no transparency
        'jpeg': ['png', 'webp', 'tiff', 'bmp', 'gif'],
        'jpg': ['png', 'webp', 'tiff', 'bmp', 'gif'],
        
        # PNG - Excellent for lossless compression, supports transparency
        'png': ['jpeg', 'jpg', 'webp', 'tiff', 'bmp', 'gif'],
        
        # WebP - Modern format with good compression
        'webp': ['jpeg', 'jpg', 'png', 'tiff', 'bmp', 'gif'],
        
        # TIFF - Good for high-quality images
        'tiff': ['jpeg', 'jpg', 'png', 'webp', 'bmp', 'gif'],
        'tif': ['jpeg', 'jpg', 'png', 'webp', 'bmp', 'gif'],
        
        # BMP - Simple, uncompressed format
        'bmp': ['jpeg', 'jpg', 'png', 'webp', 'tiff', 'gif'],
        
        # GIF - Animation support, limited colors
        'gif': ['jpeg', 'jpg', 'png', 'webp', 'tiff', 'bmp']
    }

# Initialize the SUPPORTED_FORMATS when the application starts
SUPPORTED_FORMATS = get_supported_formats()

@app.get("/api/py/supported-formats")
async def list_all_supported_formats() -> Dict[str, List[str]]:
    """
    Get all supported input formats and their possible conversion formats.
    """
    return SUPPORTED_FORMATS

@app.get("/api/py/supported-conversions/{format}", response_model=List[str])
async def get_supported_conversions(format: str) -> List[str]:
    """
    Get a list of supported conversion formats for a given input format.
    """
    format_lower = format.lower()
    if format_lower not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported input format: {format}. Supported formats are: {list(SUPPORTED_FORMATS.keys())}"
        )
    
    return SUPPORTED_FORMATS[format_lower]

@app.post("/api/py/convert/{target_format}")
async def convert_image(file: UploadFile, target_format: str):
    """
    Convert uploaded image to specified format using Pillow.
    """
    # Check if file is provided
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Read input file
    try:
        input_data = await file.read()
        input_image = Image.open(io.BytesIO(input_data))
    except Exception as e:
        logger.error(f"Error reading input file: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid image file")
    
    # Get original format
    original_format = input_image.format.lower() if input_image.format else file.filename.split('.')[-1].lower()
    target_format = target_format.lower()
    
    # Handle format aliases
    if original_format == 'jpg': original_format = 'jpeg'
    if target_format == 'jpg': target_format = 'jpeg'
    
    # Verify formats are supported
    if original_format not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported input format: {original_format}"
        )
    
    if target_format not in SUPPORTED_FORMATS[original_format]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported conversion: {original_format} to {target_format}"
        )
    
    try:
        # Create output buffer
        output_buffer = io.BytesIO()
        
        # Convert colorspace if needed
        if input_image.mode in ('RGBA', 'LA') and target_format == 'jpeg':
            # Convert to RGB, removing alpha channel
            background = Image.new('RGB', input_image.size, (255, 255, 255))
            if input_image.mode == 'LA':
                input_image = input_image.convert('RGBA')
            background.paste(input_image, mask=input_image.split()[3])
            input_image = background
        
        # Save to buffer in new format
        save_format = target_format.upper()
        save_kwargs = {}
        
        # Format-specific save options
        if target_format == 'jpeg':
            save_kwargs.update({'quality': 90, 'optimize': True})
        elif target_format == 'png':
            save_kwargs.update({'optimize': True})
        elif target_format == 'webp':
            save_kwargs.update({'quality': 90, 'method': 6})
        
        input_image.save(
            output_buffer,
            format=save_format,
            **save_kwargs
        )
        
        # Seek to start of buffer
        output_buffer.seek(0)
        
        # Get file size
        file_size = output_buffer.getbuffer().nbytes
        if file_size > 5 * 1024 * 1024:  # 5MB limit
            raise HTTPException(
                status_code=400,
                detail="Converted image exceeds size limit of 5MB"
            )
        
        # Return converted image
        return StreamingResponse(
            output_buffer,
            media_type=f"image/{target_format}",
            headers={
                'Content-Disposition': f'attachment; filename="converted.{target_format}"',
                'Content-Type': f'image/{target_format}',
                'Cache-Control': 'max-age=3600'
            }
        )
    
    except Exception as e:
        logger.error(f"Error converting image: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Image conversion failed: {str(e)}"
        )

@app.get("/api/py/health")
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "supported_formats": list(SUPPORTED_FORMATS.keys())
    }

@app.get("/api/py/version")
async def get_version_info():
    """
    Get version information about the installed Pillow and supported formats
    """
    return {
        "pillow_version": Image.__version__,
        "supported_formats": SUPPORTED_FORMATS,
        "number_of_supported_formats": len(SUPPORTED_FORMATS),
        "webp_support": features.check('webp'),
        "jpeg2000_support": features.check('jpeg_2000'),
        "zip_support": features.check('zlib')
    }

# Error handler for generic exceptions
@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}")
    return HTTPException(
        status_code=500,
        detail="An unexpected error occurred"
    )

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)