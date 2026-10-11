import React, { useState } from 'react';
import { ModalShell } from '../ui/ModalShell';
import { DynamicProfileForm } from './DynamicProfileForm';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { getEffectiveProfile } from '../../services/profileService';
import { getFriendlyFirestoreErrorMessage } from '../../utils/firebaseErrors';

export const ProfileModal = ({
  isOpen,
  onClose,
  isAdmin = false,
}) => {
  const { currentUser, userProfile, updateProfileData } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const effectiveProfile = getEffectiveProfile(userProfile, currentWorkspace?.id);

  const handleSave = async ({ data, workspaceId, asDefault }) => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await updateProfileData(data, { workspaceId, asDefault });
      setSuccessMessage('Profile saved and updated successfully!');
      setTimeout(() => {
        setSuccessMessage('');
        if (onClose) onClose();
      }, 900);
    } catch (err) {
      console.error('[UNSAID Profile Modal Save Error]', err);
      setError(getFriendlyFirestoreErrorMessage(err, 'Failed to save profile. Please check your connection and try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      title={isAdmin ? 'Administrator Professional Profile' : 'Academic & Professional Profile'}
      description="Update your institutional or corporate identity details. Form adapts dynamically."
      size="lg"
    >
      <DynamicProfileForm
        isAdmin={isAdmin}
        currentUser={currentUser}
        initialData={effectiveProfile || {}}
        activeWorkspace={currentWorkspace}
        onSave={handleSave}
        onCancel={onClose}
        isSaving={isSaving}
        error={error}
        successMessage={successMessage}
      />
    </ModalShell>
  );
};
