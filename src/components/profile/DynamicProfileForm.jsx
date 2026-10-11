import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Globe,
  Briefcase,
  GraduationCap,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
  Layers,
} from 'lucide-react';

import {
  ADMIN_PROFESSIONAL_ROLES,
  USER_ROLE_CATEGORIES,
  DEGREE_TYPES,
  YEARS_OF_STUDY,
  processProfilePhoto,
} from '../../services/profileService';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

export const DynamicProfileForm = ({
  isAdmin = false,
  currentUser = null,
  initialData = {},
  activeWorkspace = null,
  onSave,
  onCancel,
  isSaving = false,
  error = '',
  successMessage = '',
}) => {
  // Common Fields
  const [fullName, setFullName] = useState(initialData?.fullName || currentUser?.displayName || '');
  const [contactNumber, setContactNumber] = useState(initialData?.contactNumber || '');
  const [country, setCountry] = useState(initialData?.country || '');
  const [shortBio, setShortBio] = useState(initialData?.shortBio || '');
  const [avatarUrl, setAvatarUrl] = useState(initialData?.avatarUrl || currentUser?.photoURL || '');
  const [avatarPreference, setAvatarPreference] = useState(initialData?.avatarPreference || 'initials');

  // Role Selection
  const [professionalRole, setProfessionalRole] = useState(
    initialData?.professionalRole || (isAdmin ? 'Professor' : 'Student')
  );
  const [customRole, setCustomRole] = useState(initialData?.customRole || '');

  // Academic / Corporate Common Details
  const [organization, setOrganization] = useState(
    initialData?.organization || (activeWorkspace?.name ? `${activeWorkspace.name}` : '')
  );
  const [department, setDepartment] = useState(initialData?.department || '');
  const [designation, setDesignation] = useState(initialData?.designation || '');

  // Student-specific Fields
  const [course, setCourse] = useState(initialData?.course || '');
  const [degreeType, setDegreeType] = useState(initialData?.degreeType || 'B.E.');
  const [academicYear, setAcademicYear] = useState(initialData?.academicYear || '2024 - 2028');
  const [currentYearOfStudy, setCurrentYearOfStudy] = useState(initialData?.currentYearOfStudy || '1st Year');
  const [section, setSection] = useState(initialData?.section || '');
  const [rollNumber, setRollNumber] = useState(initialData?.rollNumber || '');

  // Research Scholar Fields
  const [researchProgram, setResearchProgram] = useState(initialData?.researchProgram || 'Ph.D.');
  const [researchArea, setResearchArea] = useState(initialData?.researchArea || '');
  const [supervisor, setSupervisor] = useState(initialData?.supervisor || '');

  // Professor / Faculty Fields
  const [yearsOfExperience, setYearsOfExperience] = useState(initialData?.yearsOfExperience || '');
  const [specialization, setSpecialization] = useState(initialData?.specialization || '');

  // Principal / School Admin Fields
  const [institutionType, setInstitutionType] = useState(initialData?.institutionType || 'College / University');

  // Corporate / Tech Fields
  const [team, setTeam] = useState(initialData?.team || '');
  const [employeeId, setEmployeeId] = useState(initialData?.employeeId || '');

  // Scope: Specific to Active Workspace vs Global Default
  const [saveAsWorkspaceOverride, setSaveAsWorkspaceOverride] = useState(Boolean(activeWorkspace?.id));
  const [photoUploading, setPhotoUploading] = useState(false);
  const [localPhotoError, setLocalPhotoError] = useState('');
  const [formValidationWarning, setFormValidationWarning] = useState('');

  const fileInputRef = useRef(null);

  // Synchronize when initialData changes externally
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      if (initialData.fullName !== undefined) setFullName(initialData.fullName);
      if (initialData.contactNumber !== undefined) setContactNumber(initialData.contactNumber);
      if (initialData.country !== undefined) setCountry(initialData.country);
      if (initialData.shortBio !== undefined) setShortBio(initialData.shortBio);
      if (initialData.avatarUrl !== undefined) setAvatarUrl(initialData.avatarUrl);
      if (initialData.avatarPreference !== undefined) setAvatarPreference(initialData.avatarPreference);
      if (initialData.professionalRole !== undefined) setProfessionalRole(initialData.professionalRole);
      if (initialData.customRole !== undefined) setCustomRole(initialData.customRole);
      if (initialData.organization !== undefined) setOrganization(initialData.organization);
      if (initialData.department !== undefined) setDepartment(initialData.department);
      if (initialData.designation !== undefined) setDesignation(initialData.designation);
      if (initialData.course !== undefined) setCourse(initialData.course);
      if (initialData.degreeType !== undefined) setDegreeType(initialData.degreeType);
      if (initialData.academicYear !== undefined) setAcademicYear(initialData.academicYear);
      if (initialData.currentYearOfStudy !== undefined) setCurrentYearOfStudy(initialData.currentYearOfStudy);
      if (initialData.section !== undefined) setSection(initialData.section);
      if (initialData.rollNumber !== undefined) setRollNumber(initialData.rollNumber);
      if (initialData.researchProgram !== undefined) setResearchProgram(initialData.researchProgram);
      if (initialData.researchArea !== undefined) setResearchArea(initialData.researchArea);
      if (initialData.supervisor !== undefined) setSupervisor(initialData.supervisor);
      if (initialData.yearsOfExperience !== undefined) setYearsOfExperience(initialData.yearsOfExperience);
      if (initialData.specialization !== undefined) setSpecialization(initialData.specialization);
      if (initialData.institutionType !== undefined) setInstitutionType(initialData.institutionType);
      if (initialData.team !== undefined) setTeam(initialData.team);
      if (initialData.employeeId !== undefined) setEmployeeId(initialData.employeeId);
    }
  }, [initialData]);

  // Handle Photo File Pick
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalPhotoError('');
    setPhotoUploading(true);
    try {
      const compressedDataUrl = await processProfilePhoto(file);
      setAvatarUrl(compressedDataUrl);
      setAvatarPreference('photo');
    } catch (err) {
      setLocalPhotoError(err.message || 'Unable to process image file.');
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl('');
    setAvatarPreference('initials');
  };

  // Form Submit Handler
  const handleSubmit = (e) => {
    e.preventDefault();
    setFormValidationWarning('');

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setFormValidationWarning('Full Name cannot be blank.');
      return;
    }

    if (!professionalRole) {
      setFormValidationWarning('Please select a professional or academic role.');
      return;
    }

    if (professionalRole === 'Other' && !customRole.trim()) {
      setFormValidationWarning('Please specify your custom role title.');
      return;
    }

    const payload = {
      fullName: trimmedName,
      contactNumber: contactNumber.trim(),
      country: country.trim(),
      shortBio: shortBio.trim(),
      avatarUrl: avatarUrl || null,
      avatarPreference,
      professionalRole,
      customRole: customRole.trim(),
      organization: organization.trim(),
      department: department.trim(),
      designation: designation.trim(),
      course: course.trim(),
      degreeType,
      academicYear: academicYear.trim(),
      currentYearOfStudy,
      section: section.trim(),
      rollNumber: rollNumber.trim(),
      researchProgram: researchProgram.trim(),
      researchArea: researchArea.trim(),
      supervisor: supervisor.trim(),
      yearsOfExperience: yearsOfExperience.trim(),
      specialization: specialization.trim(),
      institutionType: institutionType.trim(),
      team: team.trim(),
      employeeId: employeeId.trim(),
    };

    onSave({
      data: payload,
      workspaceId: saveAsWorkspaceOverride && activeWorkspace?.id ? activeWorkspace.id : null,
      asDefault: !saveAsWorkspaceOverride,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-xs text-[var(--text)]">
      {/* Feedback Messages */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {formValidationWarning && (
        <div className="p-3 rounded-2xl bg-[var(--warning)]/15 border border-[var(--warning)]/30 text-[var(--warning)] text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formValidationWarning}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-[var(--success-light)]/20 border border-[var(--success)]/40 text-[var(--success)] text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. PROFILE PHOTO & IDENTITY HEADER                                    */}
      {/* ===================================================================== */}
      <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex flex-col sm:flex-row items-center gap-5">
        <div className="relative shrink-0">
          <Avatar
            name={fullName || currentUser?.displayName || 'User'}
            src={avatarPreference === 'initials' ? null : avatarUrl}
            size="lg"
            isOnline={true}
          />
          {photoUploading && (
            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
          <div>
            <span className="font-semibold text-sm text-[var(--text)] block">
              Profile Photo & Avatar
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              Upload a real photo (auto-compressed) or choose the initials monogram.
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              accept="image/*"
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading || isSaving}
            >
              Upload Photo
            </Button>

            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<X className="w-3.5 h-3.5 text-[var(--danger)]" />}
                onClick={handleRemovePhoto}
                disabled={isSaving}
              >
                Remove
              </Button>
            )}

            <div className="flex items-center gap-1 border-l border-[var(--glass-border)] pl-2 ml-1">
              <button
                type="button"
                onClick={() => setAvatarPreference('photo')}
                disabled={!avatarUrl}
                className={`px-2.5 py-1 rounded-xl text-[11px] transition-all cursor-pointer ${
                  avatarPreference === 'photo' && avatarUrl
                    ? 'bg-[var(--primary)] text-white font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] opacity-60'
                }`}
              >
                Photo
              </button>
              <button
                type="button"
                onClick={() => setAvatarPreference('initials')}
                className={`px-2.5 py-1 rounded-xl text-[11px] transition-all cursor-pointer ${
                  avatarPreference === 'initials'
                    ? 'bg-[var(--primary)] text-white font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Initials
              </button>
            </div>
          </div>

          {localPhotoError && (
            <p className="text-[11px] text-[var(--danger)]">{localPhotoError}</p>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. BASIC / COMMON DETAILS                                             */}
      {/* ===================================================================== */}
      <div className="space-y-3.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Personal Information</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
              Full Name <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Sriyagowraj R"
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          {/* Email (Read-Only) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                Email Address
              </label>
              <span className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Firebase Auth
              </span>
            </div>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                disabled
                value={currentUser?.email || ''}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface)]/50 border border-[var(--glass-border)] text-xs text-[var(--text-muted)] cursor-not-allowed"
              />
            </div>
          </div>

          {/* Contact Number (Optional) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
              Contact Number <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          {/* Country (Optional) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
              Country <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Globe className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>
        </div>

        {/* Short Bio (Optional) */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
            Short Bio <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            value={shortBio}
            onChange={(e) => setShortBio(e.target.value)}
            placeholder="Brief professional summary, focus areas, or interests..."
            className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] resize-y"
          />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. DYNAMIC PROFESSIONAL OR ACADEMIC ROLE                              */}
      {/* ===================================================================== */}
      <div className="space-y-3.5 pt-2 border-t border-[var(--glass-border)]">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            {isAdmin ? (
              <Briefcase className="w-3.5 h-3.5 text-[var(--cyan)]" />
            ) : (
              <GraduationCap className="w-3.5 h-3.5 text-[var(--primary)]" />
            )}
            <span>{isAdmin ? 'Professional Role & Affiliation' : 'Academic / Professional Identity'}</span>
          </h4>
          <span className="text-[10px] text-[var(--text-muted)]">Adapts form dynamically</span>
        </div>

        {/* Role Dropdown */}
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
            {isAdmin ? 'Professional Role' : 'Select Academic or Corporate Role'} <span className="text-[var(--danger)]">*</span>
          </label>

          {isAdmin ? (
            <select
              value={professionalRole}
              onChange={(e) => setProfessionalRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--cyan)] cursor-pointer"
            >
              {ADMIN_PROFESSIONAL_ROLES.map((role) => (
                <option key={role} value={role} className="bg-[var(--surface)] text-[var(--text)]">
                  {role}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={professionalRole}
              onChange={(e) => setProfessionalRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
            >
              <optgroup label="Academic Roles">
                {USER_ROLE_CATEGORIES.academic.map((role) => (
                  <option key={role} value={role} className="bg-[var(--surface)] text-[var(--text)]">
                    {role}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Corporate & Industry Roles">
                {USER_ROLE_CATEGORIES.corporate.map((role) => (
                  <option key={role} value={role} className="bg-[var(--surface)] text-[var(--text)]">
                    {role}
                  </option>
                ))}
              </optgroup>
            </select>
          )}
        </div>

        {/* Custom Role Field if "Other" is chosen */}
        {professionalRole === 'Other' && (
          <div className="space-y-1 animate-fade-in">
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
              Specify Custom Role Title <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              required
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              placeholder="e.g. Lab Technician, Consultant, Resident Warden, Community Volunteer"
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        )}

        {/* =================================================================== */}
        {/* DYNAMIC FIELDS: ADAPTED BY SELECTED ROLE                            */}
        {/* =================================================================== */}
        <div className="p-4 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] space-y-3.5 animate-fade-in">
          <div className="flex items-center gap-2">
            <Badge variant="cyan" size="xs">
              Role Details: {professionalRole}
            </Badge>
            <span className="text-[10px] text-[var(--text-muted)]">
              Fields tailored for your position
            </span>
          </div>

          {/* DYNAMIC SCENARIO A: STUDENT */}
          {professionalRole === 'Student' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* College / Institution */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  College / School / Institution Name <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Sona College of Technology"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Department */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Department <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science and Engineering"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Course / Program */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Course / Program
                </label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. Artificial Intelligence & Data Science"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Degree Type */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Degree Type <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  value={degreeType}
                  onChange={(e) => setDegreeType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                >
                  {DEGREE_TYPES.map((deg) => (
                    <option key={deg} value={deg} className="bg-[var(--surface)] text-[var(--text)]">
                      {deg}
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Year */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Academic Year (Batch)
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="e.g. 2023 - 2027"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Current Year of Study */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Current Year of Study <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  value={currentYearOfStudy}
                  onChange={(e) => setCurrentYearOfStudy(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                >
                  {YEARS_OF_STUDY.map((yr) => (
                    <option key={yr} value={yr} className="bg-[var(--surface)] text-[var(--text)]">
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section (Optional) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Section <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g. A, B, or C"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {/* Roll Number / Student ID (Private) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                    Roll Number / Student ID <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                  </label>
                  <span className="text-[9px] text-[var(--cyan)] font-semibold flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> Private
                  </span>
                </div>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. 23CS042"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC SCENARIO B: RESEARCH SCHOLAR */}
          {professionalRole === 'Research Scholar' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Institution Name <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Sona College of Technology"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Department <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Department of Mechanical Engineering"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Research Program
                </label>
                <input
                  type="text"
                  value={researchProgram}
                  onChange={(e) => setResearchProgram(e.target.value)}
                  placeholder="e.g. Ph.D. Full-time, Postdoc, M.S. by Research"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Research Area / Topic <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={researchArea}
                  onChange={(e) => setResearchArea(e.target.value)}
                  placeholder="e.g. Deep Learning in Healthcare, Renewable Energy"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Supervisor / Guide <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  placeholder="e.g. Dr. K. Soundararajan, Professor"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC SCENARIO C: PROFESSOR / FACULTY */}
          {professionalRole === 'Professor' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Institution / College <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Sona College of Technology"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Department <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science and Engineering"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Designation <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Assistant Professor, Associate Professor, Professor"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Years of Experience <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(e.target.value)}
                  placeholder="e.g. 8 years"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Subjects / Specialization <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Operating Systems, Network Security, AI/ML"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC SCENARIO D: HOD (HEAD OF DEPARTMENT) */}
          {professionalRole === 'HOD' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Institution / College <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Sona College of Technology"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Department Managed <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Department of Information Technology"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Designation
                </label>
                <input
                  type="text"
                  value={designation || 'Head of Department'}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Professor & Head of Department"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC SCENARIO E: PRINCIPAL */}
          {professionalRole === 'Principal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  School / Institution Name <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. St. Xavier Higher Secondary School"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Institution Type
                </label>
                <input
                  type="text"
                  value={institutionType}
                  onChange={(e) => setInstitutionType(e.target.value)}
                  placeholder="e.g. Autonomous Engineering College, Higher Secondary"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Designation
                </label>
                <input
                  type="text"
                  value={designation || 'Principal'}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Principal & Dean of Academic Affairs"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC SCENARIO F: HR (HUMAN RESOURCES) */}
          {professionalRole === 'HR' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Organization / Company Name <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Infosys, Zoho, Tata Consultancy Services"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  HR Department / Team <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Talent Acquisition, People Operations, Campus Relations"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Designation <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. HR Manager, Senior Talent Partner, HRBP"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC SCENARIO G: IT STAFF */}
          {professionalRole === 'IT Staff' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Organization Name <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. University Computing Center, Tech Corp"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  IT Department / Team <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Network Infrastructure, Systems Administration"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Technical Designation <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Network Engineer, Systems Admin, Cloud Specialist"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC SCENARIO H: EMPLOYEE */}
          {professionalRole === 'Employee' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Organization / Company <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Department <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Product Engineering, Marketing, Operations"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Job Designation <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Team <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="e.g. Core UI Team, Payments Squad"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                    Employee ID <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                  </label>
                  <span className="text-[9px] text-[var(--cyan)] font-semibold flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> Private
                  </span>
                </div>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-91024"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC SCENARIO I: MANAGER / TEAM LEAD */}
          {(professionalRole === 'Manager' || professionalRole === 'Team Lead') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Organization <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Tech Solutions Pvt Ltd"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Department / Unit <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering, Product, Operations"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Designation <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Engineering Manager, Technical Team Lead"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Team Name <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="e.g. Frontend Architecture"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {/* DYNAMIC SCENARIO J: TEACHER / LECTURER / TEACHING ASSISTANT / STAFF / ADMINISTRATORS / OTHER */}
          {['Teacher', 'Lecturer', 'Teaching Assistant', 'Staff', 'School Administrator', 'College Administrator', 'Organization Administrator', 'Other'].includes(professionalRole) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Organization / Institution <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Institution or Company Name"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Department / Division <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Academic Department, Administrative Staff"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Designation / Role Title <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Lecturer, Staff Coordinator, System Administrator"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {['Teacher', 'Lecturer', 'Teaching Assistant'].includes(professionalRole) && (
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                    Subjects / Specialization <span className="text-[10px] text-[var(--text-muted)] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Mathematics, Digital Electronics, Physics"
                    className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. WORKSPACE-SPECIFIC PROFILE CONTEXT OPTION                          */}
      {/* ===================================================================== */}
      {activeWorkspace && (
        <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-start gap-3">
          <Layers className="w-4 h-4 text-[var(--cyan)] shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-[var(--text)]">
                Active Workspace Context: <span className="text-[var(--cyan)]">{activeWorkspace.name}</span>
              </span>
              <Badge variant="cyan" size="xs">
                Multi-Workspace Safe
              </Badge>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              UNSAID allows different identities across workspaces (e.g. Student in college vs Employee in company).
            </p>

            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAsWorkspaceOverride}
                onChange={(e) => setSaveAsWorkspaceOverride(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[var(--primary)] cursor-pointer"
              />
              <span className="text-xs text-[var(--text)] font-medium">
                Save specifically for &quot;{activeWorkspace.name}&quot; (keeps other workspaces isolated)
              </span>
            </label>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. FORM ACTION BUTTONS                                                */}
      {/* ===================================================================== */}
      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--glass-border)]">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSaving}
          disabled={isSaving || photoUploading}
          icon={isSaving ? undefined : <Save className="w-4 h-4" />}
        >
          {isSaving ? 'Saving Profile...' : 'Save Profile'}
        </Button>
      </div>
    </form>
  );
};
