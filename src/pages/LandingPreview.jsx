import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  UserPlus,
  Mail,
  ArrowRight,
  Sparkles,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
  Zap,
  TrendingUp,
  Layers,
  Info,
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { PageContainer } from '../components/layout/PageContainer';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { APP_CONFIG } from '../config/appConfig';

/**
 * LandingPreview Page / Auth Gateway
 * High-impact Liquid Glass gateway providing separate Admin entry and Invitation lookup.
 * Strictly blocks public user signup/signin without invite.
 */
export const LandingPreview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin } = useAuth();
  const { getInviteByToken } = useWorkspace();

  // Invite Entry Interactive State
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteInputUrl, setInviteInputUrl] = useState('');
  const [verifyingInvite, setVerifyingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Extract redirect notice if navigated from /signup or /signin without invite
  const redirectNotice =
    location.state?.message ||
    (location.state?.reason === 'invite_required'
      ? 'User accounts are created through workspace invitations. Open the invitation link shared by your workspace administrator.'
      : null);

  const handleVerifyAndOpenInvite = async (e) => {
    e.preventDefault();
    const raw = inviteInputUrl.trim();
    if (!raw) {
      setInviteError('Please enter an invitation link or token.');
      return;
    }

    setInviteError('');
    setVerifyingInvite(true);

    // Extract token whether user pasted full URL (e.g. https://domain.com/join/TOKEN) or just TOKEN
    let token = raw;
    const match = raw.match(/\/join\/([^/?#]+)/i);
    if (match && match[1]) {
      token = match[1];
    } else {
      // Clean query parameters or trailing slashes
      token = token.replace(/^[/#]+|[/?#].*$/g, '').trim();
    }

    try {
      const res = await getInviteByToken(token);
      if (!res || res.error) {
        if (res?.error === 'expired') {
          setInviteError('This invitation has expired.');
        } else if (res?.error === 'revoked') {
          setInviteError('This invitation has been revoked.');
        } else if (res?.error === 'not_found') {
          setInviteError('This workspace invitation is no longer available.');
        } else {
          setInviteError('Invitation link is invalid.');
        }
        return;
      }

      // Valid invite: Navigate to join page
      navigate(`/join/${encodeURIComponent(token)}`);
    } catch {
      setInviteError('Failed to verify invitation. Please check your connection.');
    } finally {
      setVerifyingInvite(false);
    }
  };

  return (
    <PageContainer size="lg" className="space-y-12 sm:space-y-16">
      {/* 1. Main Gateway Hero & Auth Action Panel */}
      <section className="relative pt-6 sm:pt-12 text-center max-w-3xl mx-auto space-y-6">
        {/* Status Pill Badge */}
        <div className="inline-flex items-center gap-2">
          <Badge variant="cyan" size="md" dot>
            Intelligent Query Resolution & Escalation
          </Badge>
          <span className="text-xs text-[var(--text-muted)] font-medium hidden sm:inline">
            Universal Organization Workspace
          </span>
        </div>

        {/* Brand Title & Tagline */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[var(--text)]">
            <span className="bg-gradient-to-r from-[var(--primary)] via-[#a855f7] to-[var(--cyan)] bg-clip-text text-transparent">
              {APP_CONFIG.name}
            </span>
          </h1>
          <p className="text-lg sm:text-2xl font-medium text-[var(--text-secondary)] tracking-tight">
            {APP_CONFIG.tagline}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-xl mx-auto leading-relaxed">
          {APP_CONFIG.shortDescription}
        </p>

        {/* Redirect Notice Banner (When redirected from manual /signin or /signup) */}
        {redirectNotice && (
          <div
            className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--primary)]/40 text-[var(--text)] text-xs sm:text-sm flex items-start gap-3 shadow-lg max-w-xl mx-auto text-left animate-fade-in"
            role="alert"
          >
            <Info className="w-5 h-5 text-[var(--cyan)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold text-[var(--text)]">Invitation Required</strong>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {redirectNotice}
              </p>
            </div>
          </div>
        )}

        {/* Central Gateway Panel */}
        <div className="max-w-md mx-auto pt-2">
          <GlassCard variant="panel" glow className="p-6 sm:p-8 space-y-6 text-left border border-[var(--glass-border)]">
            {isAuthenticated ? (
              /* Authenticated User Quick Action */
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mx-auto border border-[var(--primary)]/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)]">Active Session Found</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    You are currently authenticated as an {isAdmin ? 'Administrator' : 'Organization Member'}.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  iconRight={<ArrowRight className="w-5 h-5" />}
                  onClick={() => navigate(isAdmin ? '/admin' : '/app')}
                >
                  {isAdmin ? 'Open Admin Console' : 'Open My Workspace'}
                </Button>
              </div>
            ) : (
              /* Public Entry Options: Admin Sign In / Up + Invite Lookup */
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-bold text-[var(--text)]">Welcome to UNSAID</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Access administrative control or join via workspace invitation
                  </p>
                </div>

                {/* Primary Admin Access Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    icon={<ShieldCheck className="w-4 h-4" />}
                    onClick={() => navigate('/admin/signin')}
                  >
                    Admin Sign In
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    icon={<UserPlus className="w-4 h-4 text-[var(--cyan)]" />}
                    onClick={() => navigate('/admin/signup')}
                  >
                    Admin Sign Up
                  </Button>
                </div>

                {/* Visual Glass Divider */}
                <div className="relative flex items-center justify-center my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--glass-border)]" />
                  </div>
                  <span className="relative px-3 bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium rounded-full">
                    Already invited to a workspace?
                  </span>
                </div>

                {/* Invitation Trigger & Expandable Input */}
                {!showInviteInput ? (
                  <Button
                    variant="glass"
                    size="md"
                    fullWidth
                    icon={<Mail className="w-4 h-4 text-[var(--primary)]" />}
                    onClick={() => setShowInviteInput(true)}
                  >
                    Open Invitation Link
                  </Button>
                ) : (
                  <form onSubmit={handleVerifyAndOpenInvite} className="space-y-3 animate-fade-in">
                    {inviteError && (
                      <div className="p-3 rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{inviteError}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label
                        htmlFor="gateway-invite-url"
                        className="block text-xs font-semibold text-[var(--text-secondary)]"
                      >
                        Enter your invitation link or code
                      </label>
                      <div className="relative">
                        <LinkIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="gateway-invite-url"
                          type="text"
                          required
                          value={inviteInputUrl}
                          onChange={(e) => setInviteInputUrl(e.target.value)}
                          placeholder="e.g. /join/token or full link"
                          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs sm:text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowInviteInput(false);
                          setInviteError('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        fullWidth
                        isLoading={verifyingInvite}
                        iconRight={<ArrowRight className="w-4 h-4" />}
                      >
                        Verify & Continue
                      </Button>
                    </div>
                  </form>
                )}

                {/* Explanatory Microcopy */}
                <p className="text-[11px] text-center text-[var(--text-muted)] leading-relaxed pt-1">
                  Users join UNSAID through workspace invitations provided by their workspace administrator.
                </p>
              </div>
            )}
          </GlassCard>
        </div>
      </section>

      {/* 2. Floating Glass Highlight Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Card 1 */}
        <GlassCard
          glow
          className="space-y-4 hover:-translate-y-1.5 transition-transform duration-300"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/30">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Intelligent Escalation
              </h3>
              <Badge variant="high" size="sm">
                Active
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Automated query prioritization routing unresolved concerns to administrative tiers with speed and transparency.
            </p>
          </div>
        </GlassCard>

        {/* Card 2 */}
        <GlassCard
          className="space-y-4 hover:-translate-y-1.5 transition-transform duration-300"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--cyan-light)] text-[var(--cyan)] flex items-center justify-center border border-[var(--cyan)]/30">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Resolution Tracking
              </h3>
              <Badge variant="cyan" size="sm">
                Live
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Clear end-to-end progress lifecycle giving every stakeholder real-time visibility into query status.
            </p>
          </div>
        </GlassCard>

        {/* Card 3 */}
        <GlassCard
          className="space-y-4 hover:-translate-y-1.5 transition-transform duration-300"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--success-light)] text-[var(--success)] flex items-center justify-center border border-[var(--success)]/30">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Liquid Glass Architecture
              </h3>
              <Badge variant="low" size="sm">
                Spatial
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Translucent spatial surfaces with dynamic refraction, ambient lighting, and keyboard-accessible design.
            </p>
          </div>
        </GlassCard>
      </section>

      {/* 3. Showcase / Gallery CTA */}
      <section className="text-center pt-2 pb-8">
        <Button
          variant="ghost"
          size="md"
          icon={<Sparkles className="w-4 h-4 text-[var(--primary)]" />}
          onClick={() => navigate('/showcase')}
        >
          View Design System Showcase
        </Button>
      </section>
    </PageContainer>
  );
};

export default LandingPreview;
