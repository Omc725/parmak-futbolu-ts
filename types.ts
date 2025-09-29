export type Difficulty = 'very-easy' | 'easy' | 'normal' | 'hard' | 'very-hard' | 'impossible';

export interface Team {
  id: string;
  name: string;
  abbr: string;
  color1: string;
  color2: string;
  logo: string;
}

export interface LeagueInfo {
  id: string;
  name: string;
  continent: string;
  country: string;
  teams: Team[];
}

export interface MatchResult {
  team1Score: number;
  team2Score: number;
  team1Penalties?: number;
  team2Penalties?: number;
}

export interface Fixture {
  round: number;
  team1: Team;
  team2: Team;
  result?: MatchResult;
}

export interface LeagueTableRow {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface League {
  fixtures: Fixture[];
  table: LeagueTableRow[];
  currentWeek: number;
}

export interface TournamentNode {
  team1?: Team | null;
  team2?: Team | null;
  winner?: Team | null;
  result?: MatchResult;
  matchId: number;
}

export interface Tournament {
  name:string;
  playerTeam?: Team;
  rounds: TournamentNode[][];
  currentRound: number;
  winner?: Team | null;
}

export interface EuropeanCompetition {
    type: 'UCL' | 'UEL';
    status: 'active' | 'eliminated' | 'champion';
    stage: 'ro32' | 'ro16' | 'qf' | 'sf' | 'f';
    bracket: Tournament;
}

export interface Career {
    playerTeamId: string;
    playerLeagueId: string;
    currentSeason: number;
    leagues: { [key: string]: League };
    europeanCompetition: EuropeanCompetition | null;
}

export type LanguageCode = 'en' | 'zh' | 'hi' | 'es' | 'fr' | 'ar' | 'bn' | 'ru' | 'pt' | 'ur' | 'id' | 'de' | 'ja' | 'pcm' | 'mr' | 'te' | 'tr' | 'ta' | 'yue' | 'vi';
export type ColorTheme = 'dark' | 'light' | 'synthwave' | 'forest' | 'sepia';
export type ShapeTheme = 'default' | 'pixel' | 'retro' | 'sketch';
export type BallDesign = 'default' | 'classic' | 'simple' | 'star' | 'rings' | 'checkered' | 'atomic' | 'eye' | 'eight_ball' | 'tennis' | 'planet' | 'voltage';
export type TrailEffect = 'default' | 'flame' | 'pixel' | 'none';
export type FieldDesign = 'classic_day' | 'worn_pitch' | 'lush_pitch' | 'astro_turf' | 'beach_soccer' | 'pixel_pitch' | 'retro_grid' | 'street_soccer';
export type SupportedFont = 'Nunito' | 'Roboto' | 'Press Start 2P' | 'VT323' | 'Lobster';

export interface AppSettings {
    language: LanguageCode;
    colorTheme: ColorTheme;
    shapeTheme: ShapeTheme;
    difficulty: Difficulty;
    ballDesign: BallDesign;
    trailEffect: TrailEffect;
    font: SupportedFont;
    fieldDesign: FieldDesign;
}

export interface Player {
  x: number;
  y: number;
  radius: number;
  width: number;
  speed?: number;
  aiReact?: number;
  prevX: number;
  velocityX: number;
  hitAnimation: number;
}

export interface Ball {
  x: number;
  y: number;
  radius: number;
  speed: number;
  vx: number;
  vy: number;
  spin: number;
  rotation: number;
}