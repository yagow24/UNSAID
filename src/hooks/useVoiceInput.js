import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * List of speech recognition languages realistically supported
 * by Chromium / WebKit Web Speech API implementations.
 */
export const SUPPORTED_SPEECH_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi (India)' },
  { code: 'ta-IN', label: 'Tamil (India)' },
];

/**
 * Hook for managing speech-to-text input via the browser's Web Speech API.
 * Adheres strictly to browser capabilities without claiming universal translation.
 * 
 * @param {Object} options
 * @param {string} [options.defaultLanguage='en-US'] Default BCP-47 speech language
 * @param {function} [options.onTranscriptChange] Callback when new transcript arrives
 */
export const useVoiceInput = ({ defaultLanguage = 'en-US', onTranscriptChange } = {}) => {
  const [isSupported] = useState(() => {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  });
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(defaultLanguage);
  const [error, setError] = useState('');

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    isListeningRef.current = false;
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    setError('');

    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setError('Voice recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    // Stop any ongoing instance first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        setError('');
      };

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalChunk += result[0].transcript;
          } else {
            interimChunk += result[0].transcript;
          }
        }

        if (finalChunk) {
          setTranscript((prev) => {
            const separator = prev && !prev.endsWith(' ') ? ' ' : '';
            const updated = prev + separator + finalChunk.trim();
            if (onTranscriptChange) {
              onTranscriptChange(updated);
            }
            return updated;
          });
        }
        setInterimTranscript(interimChunk);
      };

      recognition.onerror = (event) => {
        console.warn('[UNSAID Voice Input Error]', event.error);
        if (event.error === 'not-allowed') {
          setError('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (event.error === 'no-speech') {
          // Normal timeout if user was quiet, don't crash
        } else if (event.error === 'network') {
          setError('Network error during speech recognition. Please check your connection.');
        } else {
          setError(`Speech error: ${event.error}`);
        }
        stopListening();
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[UNSAID Voice Input Start Failed]', err);
      setError('Failed to activate microphone. Please verify device permissions.');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [selectedLanguage, onTranscriptChange, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError('');
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    selectedLanguage,
    setSelectedLanguage,
    supportedLanguages: SUPPORTED_SPEECH_LANGUAGES,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    error,
  };
};
