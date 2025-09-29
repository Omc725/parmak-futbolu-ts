import React, { useState } from 'react';
import { Team, AppSettings } from '../types';

interface TeamLogoProps {
  team: Team;
  size: number;
  shapeTheme: AppSettings['shapeTheme'];
}

const styles = ['radial', 'split', 'hoops', 'stripes', 'sash'] as const;
type TeamStyle = typeof styles[number];

const getTeamStyle = (teamId: string): TeamStyle => {
  const hash = teamId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return styles[hash % styles.length];
};

const TeamLogo: React.FC<TeamLogoProps> = ({ team, size, shapeTheme }) => {
  const [logoError, setLogoError] = useState(false);
  const style = getTeamStyle(team.id);

  const renderFallbackLogo = () => {
    switch (style) {
      case 'split':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100">
            <rect x="0" y="0" width="50" height="100" fill={team.color1} />
            <rect x="50" y="0" width="50" height="100" fill={team.color2} />
          </svg>
        );
      case 'hoops':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100">
            <rect x="0" y="0" width="100" height="100" fill={team.color1} />
            <rect x="0" y="0" width="100" height="25" fill={team.color2} />
            <rect x="0" y="50" width="100" height="25" fill={team.color2} />
          </svg>
        );
      case 'stripes':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100">
            <defs>
              <pattern id={`stripes-${team.id.replace(/\s/g, '-')}`} patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="rotate(0)">
                <rect width="20" height="40" fill={team.color1}></rect>
                <rect x="20" width="20" height="40" fill={team.color2}></rect>
              </pattern>
            </defs>
            <rect width="100" height="100" fill={`url(#stripes-${team.id.replace(/\s/g, '-')})`} />
          </svg>
        );
      case 'sash':
         return (
          <svg width={size} height={size} viewBox="0 0 100 100">
            <rect x="0" y="0" width="100" height="100" fill={team.color1} />
            <polygon points="-20,100 20,100 120,0 80,0" fill={team.color2} />
          </svg>
        );
      case 'radial':
      default:
        return (
          <div style={{
            width: size,
            height: size,
            background: `radial-gradient(circle, ${team.color1} 40%, ${team.color2} 100%)`
          }}></div>
        );
    }
  };

  const pixelatedStyle: React.CSSProperties = shapeTheme === 'pixel' ? { imageRendering: 'pixelated' } : {};
  
  if (team.logo && team.logo !== 'placeholder' && !logoError) {
      return (
          <img
              src={team.logo}
              alt={`${team.name} Logo`}
              width={size}
              height={size}
              className="object-contain"
              style={{ width: size, height: size, ...pixelatedStyle }}
              onError={() => setLogoError(true)}
          />
      );
  }

  return (
    <div
      className="rounded-full flex-shrink-0 shadow-inner overflow-hidden"
      style={{ width: size, height: size, backgroundColor: team.color1, ...pixelatedStyle }}
    >
      {renderFallbackLogo()}
    </div>
  );
};

export default TeamLogo;