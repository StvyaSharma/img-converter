"use client"
import { useState, useEffect } from 'react';
import axios from 'axios';

const ConvertImagePage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [formats, setFormats] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [convertedFileUrl, setConvertedFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const format = file.name.split('.').pop()?.toLowerCase();
      if (format) {
        axios.get(`/api/py/supported-conversions/${format}`)
          .then(response => {
            setFormats(response.data);
            setSelectedFormat(response.data[0]);
          })
          .catch(error => {
            console.error('Error fetching supported formats:', error);
          });
      }
    }
  }, [file]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setConvertedFileUrl(null);
    }
  };

  const handleFormatChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFormat(event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !selectedFormat) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('target_format', selectedFormat);

    try {
      const response = await axios.post(`/api/py/convert/${selectedFormat}`, formData, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      setConvertedFileUrl(url);
    } catch (error) {
      console.error('Error converting image:', error);
    }
  };

  return (
    <div>
      <h1>Convert Image</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="file">Upload Image:</label>
          <input type="file" id="file" accept="image/*" onChange={handleFileChange} />
        </div>
        {formats.length > 0 && (
          <div>
            <label htmlFor="format">Select Format:</label>
            <select id="format" value={selectedFormat} onChange={handleFormatChange}>
              {formats.map(format => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>
        )}
        <button type="submit">Convert</button>
      </form>
      {convertedFileUrl && (
        <div>
          <h2>Converted Image:</h2>
          <a href={convertedFileUrl} download={`converted.${selectedFormat}`}>Download Converted Image</a>
        </div>
      )}
    </div>
  );
};

export default ConvertImagePage;