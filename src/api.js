import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

export const uploadExcel = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await axios.post(`${API_URL}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const generateTags = async (lines) => {
  const response = await axios.post(`${API_URL}/analyze_emotions`, { lines });
  return response.data;
};