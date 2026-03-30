// NHL API response types for api-web.nhle.com

export interface NhlLocalizedString {
  default: string;
  fr?: string;
}

export interface NhlBracketTeam {
  id: number;
  abbrev: string;
  name: NhlLocalizedString;
  commonName: NhlLocalizedString;
  logo: string;
  darkLogo: string;
}

export interface NhlBracketSeries {
  seriesUrl: string;
  seriesTitle: string;
  seriesAbbrev: string; // R1, R2, ECF, WCF, SCF
  seriesLetter: string; // A-O
  playoffRound: number; // 1-4
  topSeedRank: number;
  topSeedRankAbbrev: string;
  topSeedWins: number;
  bottomSeedRank: number;
  bottomSeedRankAbbrev: string;
  bottomSeedWins: number;
  winningTeamId?: number;
  losingTeamId?: number;
  topSeedTeam: NhlBracketTeam;
  bottomSeedTeam: NhlBracketTeam;
  conferenceAbbrev?: string;
  conferenceName?: string;
}

export interface NhlBracketResponse {
  bracketLogo: string;
  bracketLogoFr: string;
  bracketTitle?: NhlLocalizedString;
  bracketSubTitle?: NhlLocalizedString;
  series: NhlBracketSeries[];
}

export interface NhlStandingsTeam {
  teamName: NhlLocalizedString;
  teamCommonName: NhlLocalizedString;
  teamAbbrev: { default: string };
  teamLogo: string;
  placeName: NhlLocalizedString;
  conferenceAbbrev: string;
  conferenceName: string;
  divisionAbbrev: string;
  divisionName: string;
  clinchIndicator?: string;
  seasonId: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  wildcardSequence: number;
  divisionSequence: number;
  conferenceSequence: number;
  leagueSequence: number;
}

export interface NhlStandingsResponse {
  wildCardIndicator: boolean;
  standings: NhlStandingsTeam[];
}
