export interface RepoOwner {
  login: string
  avatar_url: string
  html_url: string
}

export interface Repo {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  owner: RepoOwner
  language: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  topics?: string[]
  created_at: string
  pushed_at: string
  archived?: boolean
}

export interface GitHubUser {
  login: string
  avatar_url: string
  html_url: string
  name: string | null
}

export interface SearchReposResponse {
  total_count: number
  incomplete_results: boolean
  items: Repo[]
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}
