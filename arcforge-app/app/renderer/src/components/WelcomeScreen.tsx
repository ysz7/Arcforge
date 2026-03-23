/**
 * Welcome screen when no project is open. Centered: app icon, quick actions with shortcuts.
 */

import React from 'react';

import { AppIcon } from './AppIcon';

declare const window: Window & { arcforge?: import('../../../shared/types').ArcforgeAPI };

export const WelcomeScreen: React.FC = () => {
  return (
    <div className="arcforge-welcome">
      <div className="arcforge-welcome-content">
        <AppIcon size={130} className="arcforge-welcome-logo" />
        <div className="arcforge-welcome-arch-row">
          <button
            type="button"
            className="arcforge-welcome-action arcforge-welcome-action-open-project"
            onClick={() => window.dispatchEvent(new CustomEvent('arcforge:open-project-modal'))}
          >
            <span className="arcforge-welcome-action-label">Open Project</span>
          </button>
        </div>
        <div className="arcforge-welcome-arch-row">
          <button
            type="button"
            className="arcforge-welcome-action"
            onClick={() => window.arcforge?.project.createArchitecture?.()}
          >
            <span className="arcforge-welcome-action-label">Create new ArcSpec</span>
          </button>
          <button
            type="button"
            className="arcforge-welcome-action"
            onClick={() => window.arcforge?.project.openArchitecture?.()}
          >
            <span className="arcforge-welcome-action-label">Open ArcSpec</span>
          </button>
        </div>
      </div>
    </div>
  );
};
