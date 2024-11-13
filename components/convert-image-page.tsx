"use client"

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight, FileImage, Download, X, CheckCircle, Loader2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import { toast, Toaster } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export function ConvertImagePageComponent() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [formats, setFormats] = useState<string[]>([])
  const [selectedFormat, setSelectedFormat] = useState<string>('')
  const [convertedFileUrl, setConvertedFileUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0]
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setConvertedFileUrl(null)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {'image/*': []},
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  useEffect(() => {
    if (file) {
      const format = file.name.split('.').pop()?.toLowerCase()
      if (format) {
        setIsLoading(true)
        toast.promise(
          axios.get(`/api/py/supported-conversions/${format}`)
            .then(response => {
              setFormats(response.data)
              setSelectedFormat(response.data[0])
            })
            .finally(() => setIsLoading(false)),
          {
            loading: 'Fetching supported formats...',
            success: 'Formats loaded successfully',
            error: 'Failed to fetch supported formats'
          }
        )
      }
    }
  }, [file])

  const handleFormatChange = (value: string) => {
    setSelectedFormat(value)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file || !selectedFormat) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('target_format', selectedFormat)

    toast.promise(
      (async () => {
        setIsLoading(true)
        try {
          const response = await axios.post(`/api/py/convert/${selectedFormat}`, formData, {
            responseType: 'blob'
          })
          const url = URL.createObjectURL(new Blob([response.data]))
          setConvertedFileUrl(url)
          return 'Image converted successfully'
        } finally {
          setIsLoading(false)
        }
      })(),
      {
        loading: 'Converting image...',
        success: 'Image converted successfully',
        error: 'Failed to convert image'
      }
    )
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setConvertedFileUrl(null)
    setFormats([])
    setSelectedFormat('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center py-6 px-4 sm:py-12 sm:px-6 lg:px-8">
      <Toaster richColors position="top-right" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        <Card className="mx-auto max-w-3xl shadow-lg">
          <CardHeader className="space-y-1 bg-gray-50 rounded-t-lg border-b border-gray-200 p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-center text-gray-800">Image Converter</CardTitle>
            <p className="text-sm text-gray-500 text-center">Convert your images to various formats with ease</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="file" className="text-sm font-medium text-gray-700">Upload Image</Label>
                <div 
                  {...getRootProps()} 
                  className={`mt-1 flex justify-center px-4 py-4 sm:px-6 sm:pt-5 sm:pb-6 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-gray-400 transition-colors ${isDragActive ? 'border-primary bg-primary/5' : ''}`}
                >
                  <input {...getInputProps()} />
                  <div className="space-y-1 text-center">
                    <FileImage className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
                    <div className="flex flex-col sm:flex-row text-sm text-gray-600 items-center gap-1">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                        <span>Upload a file</span>
                      </label>
                      <p className="sm:pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
              </div>
              
              <AnimatePresence>
                {preview && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative w-full flex justify-center"
                  >
                    <div className="relative w-full max-w-xs sm:max-w-sm">
                      <Image 
                        src={preview} 
                        alt="Preview" 
                        width={300} 
                        height={300} 
                        className="rounded-lg w-full h-auto shadow-md" 
                      />
                      <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon"
                        className="absolute top-2 right-2 rounded-full" 
                        onClick={clearFile}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {formats.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="format" className="text-sm font-medium text-gray-700">Select Format</Label>
                  <Select value={selectedFormat} onValueChange={handleFormatChange}>
                    <SelectTrigger id="format" className="w-full">
                      <SelectValue placeholder="Select a format" />
                    </SelectTrigger>
                    <SelectContent>
                      {formats.map(format => (
                        <SelectItem key={format} value={format}>{format.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-dark text-white transition-colors"
                disabled={!file || !selectedFormat || isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Converting...
                  </span>
                ) : (
                  <span className="flex items-center">
                    Convert <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>

          <AnimatePresence>
            {convertedFileUrl && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <CardFooter className="flex flex-col items-center space-y-4 p-4 sm:p-6 bg-gray-50 rounded-b-lg border-t border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-700 flex items-center">
                    <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                    Conversion Complete
                  </h2>
                  <div className="w-full max-w-xs sm:max-w-sm">
                    <Image 
                      src={convertedFileUrl} 
                      alt="Converted" 
                      width={300} 
                      height={300} 
                      className="rounded-lg shadow-md w-full h-auto" 
                    />
                  </div>
                  <Button asChild variant="outline" className="w-full max-w-xs">
                    <a href={convertedFileUrl} download={`converted.${selectedFormat}`}>
                      <Download className="mr-2 h-4 w-4" /> Download Converted Image
                    </a>
                  </Button>
                </CardFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  )
}