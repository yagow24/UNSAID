import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  Send,
  Clock,
  ShieldAlert,
  Tag,
  Image as ImageIcon,
  Camera,
  Mic,
  MicOff,
  Globe,
  RotateCcw,
  Check,
  CheckCircle,
  X,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { submitProblem } from '../../services/problemService';
import { uploadProblemImage, validateImageFile } from '../../services/storageService';
import { getActiveQuickPicks, getContextualSubIssues } from '../../config/quickPicksConfig';
import { getShiftStatus } from '../../config/shiftConfig';
import { useIdentity } from '../../hooks/useIdentity';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { PreSubmitAIModal } from './PreSubmitAIModal';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useAuth } from '../../hooks/useAuth';
import { getFriendlyFirestoreErrorMessage } from '../../utils/firebaseErrors';

export const SubmitProblemModal = ({
  isOpen,
  onClose,
  workspace: propWorkspace,
  currentUser: propCurrentUser,
  userProfile: propUserProfile,
  onProblemSubmitted,
  defaultEmergency = false,
}) => {
  const { currentUser: authUser, userProfile: authProfile } = useAuth();
  const currentUser = propCurrentUser || authUser;
  const userProfile = propUserProfile || authProfile;
  const { currentWorkspace: ctxWorkspace, workspaces } = useWorkspace();
  const workspace = propWorkspace?.id ? propWorkspace : ctxWorkspace?.id ? ctxWorkspace : (workspaces?.length > 0 ? workspaces[0] : null);
  const { isAnonymous: defaultAnonymous, pseudonym, displayName } = useIdentity();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [subIssue, setSubIssue] = useState('');
  const [isEmergency, setIsEmergency] = useState(defaultEmergency);
  const [isConfidential, setIsConfidential] = useState(false);
  const [isAnonPost, setIsAnonPost] = useState(defaultAnonymous);
  const [workaround, setWorkaround] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pre-Submit AI Modal State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [resolvedLocallyNotice, setResolvedLocallyNotice] = useState(false);

  // Photo Upload & Camera State
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Voice Input Hook
  const handleTranscriptChange = useCallback((updatedTranscript) => {
    setDescription((prev) => {
      // Append if previous text exists
      if (!prev) return updatedTranscript;
      return prev.trim() + ' ' + updatedTranscript.trim();
    });
  }, []);

  const {
    isSupported: voiceSupported,
    isListening,
    selectedLanguage,
    setSelectedLanguage,
    supportedLanguages,
    toggleListening,
    stopListening,
    clearTranscript,
    error: voiceError,
  } = useVoiceInput({
    defaultLanguage: 'en-US',
    onTranscriptChange: handleTranscriptChange,
  });

  // Stop camera tracks cleanly
  const cleanupMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopCameraStream = useCallback(() => {
    cleanupMediaTracks();
    setIsCameraActive(false);
  }, [cleanupMediaTracks]);

  // Sync defaultEmergency when modal opens with emergency intent
  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (!ignore && isOpen) {
        setIsEmergency(defaultEmergency);
        setIsConfidential(false);
        setIsAnonPost(defaultAnonymous);
        setResolvedLocallyNotice(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, [isOpen, defaultEmergency, defaultAnonymous]);

  // Clean up media resources on unmount or modal close
  useEffect(() => {
    if (!isOpen) {
      cleanupMediaTracks();
      stopListening();
    }
    return () => {
      cleanupMediaTracks();
      stopListening();
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [isOpen, cleanupMediaTracks, stopListening, imagePreviewUrl]);

  const quickPicks = getActiveQuickPicks(workspace?.quickPicks);
  const contextualSubIssues = getContextualSubIssues(category, title, workspace?.subIssueOptions);
  const shiftStatus = getShiftStatus(workspace?.shiftConfig);

  const handleSelectQuickPick = (qp) => {
    setCategory(qp.category || 'General');
    setTitle(qp.issueTitle || qp.label);
    setSubIssue('');
  };

  const handleToggleSubIssue = (chip) => {
    setSubIssue((prev) => (prev === chip ? '' : chip));
  };

  const handleImagePicked = (file) => {
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setError('');
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    stopCameraStream();
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Start live camera stream
  const handleStartCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported on this device/browser. Please choose an image file.');
      return;
    }

    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('[UNSAID Camera Access Error]', err);
      setIsCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in browser settings or choose a photo file.');
      } else {
        setCameraError('Unable to access camera hardware. Please select an image file instead.');
      }
    }
  };

  // Capture frame from video to File
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `camera_capture_${Date.now()}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          handleImagePicked(file);
        }
      },
      'image/jpeg',
      0.9
    );
  };

  const handleClose = () => {
    stopCameraStream();
    stopListening();
    setTitle('');
    setDescription('');
    setCategory('General');
    setSubIssue('');
    setIsEmergency(false);
    setIsConfidential(false);
    setWorkaround('');
    setError('');
    setCameraError('');
    setIsAIModalOpen(false);
    setResolvedLocallyNotice(false);
    handleRemoveImage();
    onClose();
  };

  // Validates form fields before proceeding
  const validateForm = () => {
    if (!title.trim()) {
      setError('Please provide a brief problem title.');
      return false;
    }
    if (!description.trim()) {
      setError('Please provide a clear description of the issue.');
      return false;
    }
    if (!workspace?.id) {
      setError('Active workspace context is missing.');
      return false;
    }
    setError('');
    return true;
  };

  // Click handler from the initial form
  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Emergency queries or Confidential queries bypass the pre-submit AI suggestion step
    if (isEmergency || isConfidential) {
      executePublish();
    } else {
      setIsAIModalOpen(true);
    }
  };

  // Final submission execution (writes to Firebase Storage & Firestore)
  const executePublish = async () => {
    setError('');
    setSubmitting(true);

    try {
      let imageUrl = null;
      let imagePath = null;

      // Upload image to Firebase Storage if selected
      if (selectedImage) {
        try {
          const uploadRes = await uploadProblemImage({
            workspaceId: workspace.id,
            userId: currentUser?.uid || 'anon',
            file: selectedImage,
          });
          if (uploadRes) {
            imageUrl = uploadRes.imageUrl;
            imagePath = uploadRes.imagePath;
          }
        } catch (uploadErr) {
          console.warn('[UNSAID Problem Submit] Photo upload failed:', uploadErr.message);
          setError(uploadErr.message || 'Image upload failed.');
          setSubmitting(false);
          setIsAIModalOpen(false);
          return;
        }
      }

      const created = await submitProblem({
        workspaceId: workspace.id,
        title,
        description,
        category,
        subIssue,
        isEmergency,
        isConfidential,
        workaround,
        shiftStatus: shiftStatus.label,
        currentUser,
        userProfile,
        isAnonymous: isAnonPost,
        pseudonym,
        imageUrl,
        imagePath,
      });

      if (onProblemSubmitted) {
        onProblemSubmitted(created);
      }

      handleClose();
    } catch (err) {
      console.error('[UNSAID Problem Submit Error]', err);
      setError(getFriendlyFirestoreErrorMessage(err, 'Failed to submit problem. Please try again.'));
      setIsAIModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // User was satisfied with AI resolution: close flow without Firestore doc
  const handleSatisfiedLocally = () => {
    setIsAIModalOpen(false);
    setResolvedLocallyNotice(true);
  };

  return (
    <>
      <ModalShell
        isOpen={isOpen && !isAIModalOpen}
        onClose={handleClose}
        title={isEmergency ? 'Report Emergency Problem' : 'Report Workspace Problem'}
        subtitle={`Submitting to "${workspace?.name || 'Workspace'}"`}
        maxWidth="lg"
      >
        {resolvedLocallyNotice ? (
          <div className="py-8 px-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[var(--success)]/15 border border-[var(--success)]/30 text-[var(--success)] flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text)]">Resolved Instantly</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
                Glad we could help. Your problem was resolved without publishing it.
              </p>
            </div>
            <div className="pt-2">
              <Button type="button" variant="primary" size="md" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInitialSubmit} className="space-y-5 pt-1">
            {/* Shift Awareness Notice */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--primary)] shrink-0" />
                <span className="text-[var(--text-muted)]">
                  Current Workspace Window:{' '}
                  <strong className="text-[var(--text)]">{shiftStatus.label}</strong> ({shiftStatus.shiftSummary})
                </span>
              </div>
              <Badge variant={shiftStatus.isShiftActive ? 'low' : 'neutral'} size="sm" dot>
                {shiftStatus.isShiftActive ? 'Online Triage' : 'Off Hours Queue'}
              </Badge>
            </div>

            {/* Identity & Posting Attribution */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)] font-medium">Posting as:</span>
                <strong className={`font-semibold ${isAnonPost ? 'text-[var(--cyan)] font-mono' : 'text-[var(--text)]'}`}>
                  {isAnonPost ? pseudonym : displayName}
                </strong>
              </div>
              <div className="inline-flex p-0.5 rounded-full bg-[var(--surface-hover)] border border-[var(--glass-border)]">
                <button
                  type="button"
                  onClick={() => setIsAnonPost(false)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                    !isAnonPost
                      ? 'bg-[var(--primary)] text-white shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnonPost(true)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                    isAnonPost
                      ? 'bg-[var(--cyan)] text-white shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Anonymous
                </button>
              </div>
            </div>

            {/* Confidential 1-on-1 Direct Thread to Admin/Staff */}
            <div
              className={`p-3 rounded-2xl border transition-all ${
                isConfidential
                  ? 'bg-[var(--primary)]/10 border-[var(--primary)]/40 shadow-xs'
                  : 'bg-[var(--surface)] border-[var(--glass-border)]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isConfidential
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-[var(--text)]">
                        Confidential 1-on-1 Direct Message
                      </span>
                      <Badge variant={isConfidential ? 'primary' : 'neutral'} size="xs">
                        {isConfidential ? 'Private to Admin' : 'Public Feed'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {isConfidential
                        ? 'Never appears in public workspace feed; strictly accessible to you and authorized workspace admins.'
                        : 'Visible to members in this workspace.'}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isConfidential}
                    onChange={(e) => setIsConfidential(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[var(--surface-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                </label>
              </div>
            </div>

            {/* Emergency Alert Banner when toggled */}
            {isEmergency && (
              <div className="p-4 rounded-2xl bg-[var(--danger-light)] border-2 border-[var(--danger)]/60 text-[var(--danger)] text-xs space-y-1 shadow-sm ring-2 ring-[var(--danger)]/20 animate-pulse motion-reduce:animate-none">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />
                  <span>Emergency query</span>
                </div>
                <p className="leading-relaxed text-[var(--text)] font-medium">
                  Emergency queries bypass standard AI pre-resolution for immediate workspace response.
                </p>
              </div>
            )}

            {/* Contextual Quick Picks */}
            {quickPicks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[var(--cyan)]" />
                    Quick Picks
                  </span>
                  {quickPicks[0]?.isFallback && (
                    <span className="text-[10px] text-[var(--text-muted)] italic">
                      Standard templates
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickPicks.map((qp) => (
                    <button
                      key={qp.id}
                      type="button"
                      onClick={() => handleSelectQuickPick(qp)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                        title === qp.issueTitle || title === qp.label
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                          : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="prob-title">
                Problem Title <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                id="prob-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Wi-Fi connection dropping on 3rd floor"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            {/* Category & Emergency Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Category Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="prob-cat">
                  Category
                </label>
                <select
                  id="prob-cat"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setSubIssue('');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                >
                  <option value="General">General</option>
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Access">Access</option>
                  <option value="Facilities">Facilities</option>
                  <option value="Technical">Technical</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Emergency Checkbox / Toggle */}
              <div className="space-y-1.5 flex flex-col justify-end">
                <label
                  htmlFor="prob-emergency"
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    isEmergency
                      ? 'bg-[var(--danger-light)] border-[var(--danger)] text-[var(--danger)]'
                      : 'bg-[var(--surface)] border-[var(--glass-border)] text-[var(--text)]'
                  }`}
                >
                  <input
                    id="prob-emergency"
                    type="checkbox"
                    checked={isEmergency}
                    onChange={(e) => setIsEmergency(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--danger)] accent-[var(--danger)] cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-semibold block">Mark as Emergency</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Immediate priority dispatch</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Contextual Sub-Issues Chips */}
            {contextualSubIssues.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                    Sub-Issue Focus <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
                  </label>
                  {subIssue && (
                    <button
                      type="button"
                      onClick={() => setSubIssue('')}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contextualSubIssues.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggleSubIssue(chip)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                        subIssue === chip
                          ? 'bg-[var(--cyan)] text-white border-[var(--cyan)] shadow-xs'
                          : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {subIssue === chip && <Check className="w-3 h-3" />}
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Description with Voice Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="prob-desc">
                  Description <span className="text-[var(--danger)]">*</span>
                </label>

                {/* Voice Recognition Controls */}
                <div className="flex items-center gap-1.5">
                  {voiceSupported ? (
                    <>
                      {/* Language Selection */}
                      <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--glass-border)] rounded-lg px-1.5 py-0.5 text-[10px]">
                        <Globe className="w-3 h-3 text-[var(--text-muted)]" />
                        <select
                          aria-label="Speech Recognition Language"
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="bg-transparent text-[var(--text)] focus:outline-none cursor-pointer"
                        >
                          {supportedLanguages.map((lang) => (
                            <option key={lang.code} value={lang.code} className="bg-[var(--bg)] text-[var(--text)]">
                              {lang.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Microphone Toggle Button */}
                      <button
                        type="button"
                        aria-label={isListening ? 'Stop voice recording' : 'Start voice recording'}
                        onClick={toggleListening}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          isListening
                            ? 'bg-[var(--danger)] text-white animate-pulse'
                            : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)] text-[var(--text)]'
                        }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="w-3 h-3" />
                            <span>Listening...</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3 h-3 text-[var(--primary)]" />
                            <span>Voice</span>
                          </>
                        )}
                      </button>

                      {description && (
                        <button
                          type="button"
                          aria-label="Clear voice transcript"
                          onClick={clearTranscript}
                          title="Clear speech transcript"
                          className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-[var(--text-muted)]">Voice input unavailable in browser</span>
                  )}
                </div>
              </div>

              {voiceError && (
                <p className="text-[11px] text-[var(--danger)] bg-[var(--danger-light)] p-2 rounded-lg">
                  {voiceError}
                </p>
              )}

              <textarea
                id="prob-desc"
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what is happening, where it occurs, and how it impacts people in this workspace..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
              />
            </div>

            {/* Camera / Photo Section */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Photo / Visual Proof <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleImagePicked(e.target.files[0]);
                }}
              />

              {cameraError && (
                <p className="text-[11px] text-[var(--danger)] bg-[var(--danger-light)] p-2 rounded-lg">
                  {cameraError}
                </p>
              )}

              {/* Live Camera Viewport */}
              {isCameraActive && (
                <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={stopCameraStream}
                      icon={<X className="w-3.5 h-3.5" />}
                    >
                      Cancel Camera
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={<Camera className="w-3.5 h-3.5" />}
                      onClick={handleCapturePhoto}
                    >
                      Capture Photo
                    </Button>
                  </div>
                </div>
              )}

              {/* Preview of captured/selected image */}
              {!isCameraActive && imagePreviewUrl && (
                <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={imagePreviewUrl}
                      alt="Attachment Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-[var(--glass-border)] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[var(--text)] truncate">
                        {selectedImage?.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {(selectedImage?.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleStartCamera}
                      icon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      Retake
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-[var(--danger)] hover:bg-[var(--danger-light)]"
                      onClick={handleRemoveImage}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload or Camera Launch Buttons */}
              {!isCameraActive && !imagePreviewUrl && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<ImageIcon className="w-4 h-4 text-[var(--cyan)]" />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Select Photo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<Camera className="w-4 h-4 text-[var(--primary)]" />}
                    onClick={handleStartCamera}
                  >
                    Take Photo
                  </Button>
                </div>
              )}
            </div>

            {/* Proposed Workaround */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]" htmlFor="prob-workaround">
                Proposed Workaround <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
              </label>
              <input
                id="prob-workaround"
                type="text"
                value={workaround}
                onChange={(e) => setWorkaround(e.target.value)}
                placeholder="What have you already tried, or what workaround are you suggesting?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--glass-border)]">
              <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={isEmergency ? 'danger' : 'primary'}
                size="md"
                isLoading={submitting}
                disabled={submitting}
                icon={isEmergency ? <AlertTriangle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              >
                {isEmergency ? 'Broadcast Emergency' : 'Continue'}
              </Button>
            </div>
          </form>
        )}
      </ModalShell>

      {/* Pre-Submit AI Knowledge Resolution & Query Preview Modal */}
      <PreSubmitAIModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onBackToEdit={() => setIsAIModalOpen(false)}
        onSatisfied={handleSatisfiedLocally}
        onPublish={executePublish}
        submitting={submitting}
        problemDraft={{
          workspaceId: workspace?.id,
          title,
          description,
          category,
          subIssue,
          workaround,
          isEmergency,
          isConfidential,
          isAnonPost,
          pseudonym,
          displayName,
          selectedImage,
          imagePreviewUrl,
        }}
      />
    </>
  );
};
