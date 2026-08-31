'use client';

import type { ConnectionCondition } from '@operari/shared';
import { AlertTriangle, Ban, Check, Circle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ConnectionConditionBadgeProps {
  condition: ConnectionCondition;
  position: { x: number; y: number };
  connectionId: string;
  onConditionChange: (connectionId: string, condition: ConnectionCondition) => void;
  zoom: number;
}

const CONDITION_CONFIG: Record<
  ConnectionCondition,
  { color: string; icon: typeof Check; label: string }
> = {
  complete: { color: '#3ecf8e', icon: Circle, label: 'Complete' },
  success: { color: '#22c55e', icon: Check, label: 'Success' },
  error: { color: '#ef4444', icon: X, label: 'Error' },
  warning: { color: '#eab308', icon: AlertTriangle, label: 'Warning' },
  disabled: { color: '#6b7280', icon: Ban, label: 'Disabled' },
};

const CONDITIONS: ConnectionCondition[] = ['complete', 'success', 'error', 'warning', 'disabled'];

export default function ConnectionConditionBadge({
  condition,
  position,
  connectionId,
  onConditionChange,
  zoom,
}: ConnectionConditionBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const config = CONDITION_CONFIG[condition];
  const Icon = config.icon;

  // Close menu on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelectCondition = (newCondition: ConnectionCondition) => {
    onConditionChange(connectionId, newCondition);
    setIsOpen(false);
  };

  // Scale size based on zoom — slightly larger for readability
  const size = Math.max(22, 28 / zoom);
  const iconSize = Math.max(12, 14 / zoom);

  return (
    <div
      ref={menuRef}
      className="connection-condition-badge"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        zIndex: 15,
      }}
    >
      {/* Badge Button — diamond shape for visual distinction from
           the circular output poles and squared input poles */}
      <button
        onClick={handleClick}
        className="connection-badge-button"
        style={{
          width: size,
          height: size,
          borderRadius: '5px',
          transform: 'rotate(45deg)',
          backgroundColor: config.color,
          border: '2.5px solid rgba(255,255,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          boxShadow: isOpen
            ? `0 0 0 4px rgba(255,255,255,0.25), 0 4px 12px ${config.color}70`
            : `0 0 0 2px rgba(0,0,0,0.3), 0 2px 8px ${config.color}50`,
        }}
        onMouseEnter={e => {
          (e.target as HTMLElement).style.transform = 'rotate(45deg) scale(1.2)';
        }}
        onMouseLeave={e => {
          (e.target as HTMLElement).style.transform = 'rotate(45deg) scale(1)';
        }}
        title={config.label}
      >
        <span style={{ transform: 'rotate(-45deg)', display: 'flex' }}>
          <Icon size={iconSize} color="white" strokeWidth={3} />
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="connection-condition-menu"
          style={{
            position: 'absolute',
            top: size + 4,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--box-background-color, #1a1a2e)',
            border: '1px solid var(--border-color, #2d2d44)',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: '120px',
            zIndex: 100,
          }}
        >
          {CONDITIONS.map(cond => {
            const condConfig = CONDITION_CONFIG[cond];
            const CondIcon = condConfig.icon;
            const isSelected = cond === condition;

            return (
              <button
                key={cond}
                onClick={() => handleSelectCondition(cond)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: 'var(--body-text-color, white)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textAlign: 'left',
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    (e.target as HTMLElement).style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: condConfig.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CondIcon size={10} color="white" strokeWidth={3} />
                </div>
                <span>{condConfig.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
