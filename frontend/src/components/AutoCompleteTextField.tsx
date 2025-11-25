import React, { useState, useEffect, useRef } from 'react';
import {
  TextField,
  Autocomplete,
  CircularProgress,
  Box,
  ListItemText,
  Typography,
} from '@mui/material';
import api from '../services/api';

// Функция для подсветки текста
const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query || query.length < 2) {
    return text;
  }

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Typography component="span" key={index} sx={{ fontWeight: 'bold', bgcolor: 'yellow' }}>
            {part}
          </Typography>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
};

interface AutoCompleteTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  endpoint: string;
  getOptionLabel: (option: any) => string;
  minLength?: number;
  debounceMs?: number;
  maxResults?: number;
  placeholder?: string;
  fullWidth?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

export const AutoCompleteTextField: React.FC<AutoCompleteTextFieldProps> = ({
  label,
  value,
  onChange,
  endpoint,
  getOptionLabel,
  minLength = 2,
  debounceMs = 300,
  maxResults = 10,
  placeholder,
  fullWidth = true,
  required = false,
  error = false,
  helperText,
}) => {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (inputValue.length < minLength) {
      setOptions([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await api.get(endpoint, {
          params: { q: inputValue },
        });
        const results = Array.isArray(response.data) ? response.data : [];
        setOptions(results.slice(0, maxResults));
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue, endpoint, minLength, debounceMs, maxResults]);

  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue);
        onChange(newInputValue);
      }}
      onChange={(_, newValue) => {
        const value = typeof newValue === 'string' ? newValue : getOptionLabel(newValue);
        onChange(value);
      }}
      getOptionLabel={getOptionLabel}
      loading={loading}
      fullWidth={fullWidth}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => {
        const label = getOptionLabel(option);
        return (
          <Box component="li" {...props} key={option.id || option.name}>
            <ListItemText primary={highlightText(label, inputValue)} />
          </Box>
        );
      }}
    />
  );
};

