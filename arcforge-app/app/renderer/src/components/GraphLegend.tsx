/**
 * Legend for the graph: node types, edge types, flow direction.
 * Collapsed by default; click title to expand.
 */

import React, { useState } from 'react';
import { NODE_COLORS } from './graph';

export const GraphLegend: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`arcforge-graph-legend ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="arcforge-graph-legend-title"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse legend' : 'Expand legend'}
      >
        Architecture Flow
        <span className="arcforge-graph-legend-chevron" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded && (
        <>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: '#334155' }} />
            Entry Point
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.route_resource.bg }} />
            Resource (Route::resource / apiResource)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.route_group.bg }} />
            Route group (prefix)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.route.bg }} />
            Route (HTTP)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.controller.bg }} />
            Controller
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.service.bg }} />
            Service (Logic)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.model.bg }} />
            Model (DB)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.repository.bg }} />
            Repository (data access)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.infrastructure_repository.bg }} />
            Infrastructure (DDD)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.interface.bg }} />
            Interface (contract)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.domain_interface.bg }} />
            Domain interface (DDD)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.entity.bg }} />
            Entity (generic)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.domain_entity.bg }} />
            Domain entity (DDD)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.application_service.bg }} />
            Application service (DDD)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.migration_group.bg }} />
            Migration group
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.migration.bg }} />
            Migration (schema)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.seeder.bg }} />
            Seeder
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.policy.bg }} />
            Policy
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.observer.bg }} />
            Observer
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.resource.bg }} />
            API Resource
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.middleware.bg }} />
            Middleware
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.job.bg }} />
            Job
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.event.bg }} />
            Event
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.listener.bg }} />
            Listener
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.form_request.bg }} />
            Form Request
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-dot" style={{ background: NODE_COLORS.database.bg }} />
            Database connection
          </div>
          <div className="arcforge-graph-legend-divider" />
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-line" style={{ background: '#64748b' }} />
            Flow
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-line" style={{ background: '#94a3b8' }} />
            URL → Controller
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-line dependency" />
            Dependency (DI)
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-line" style={{ background: '#7c3aed' }} />
            Implements
          </div>
          <div className="arcforge-graph-legend-row">
            <span className="arcforge-graph-legend-line" style={{ background: '#f59e0b' }} />
            Relationship
          </div>
        </>
      )}
    </div>
  );
};
