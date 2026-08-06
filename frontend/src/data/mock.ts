import type { Role } from '../types'

export interface Startup {
  id: string
  name: string
  tagline: string
  description: string
  industry: string
  teamNeeded: string[]
  equity: string
  applicants: number
  fundingNeeded?: string
  teamSize?: number
  match?: number
}

export interface Application {
  id: string
  startup: string
  applicant: string
  role: string
  match: number
  status: 'pending' | 'shortlisted' | 'rejected'
  time: string
}

export interface Message {
  id: string
  sender: string
  preview: string
  time: string
  unread: boolean
}

export interface Notification {
  id: string
  type: 'message' | 'application' | 'milestone'
  text: string
  time: string
  read: boolean
}

export const mockStartups: Startup[] = [
  {
    id: 's1',
    name: 'FinTrack',
    tagline: 'AI-powered personal finance for Gen Z',
    description: 'FinTrack automates budgeting and investing with AI insights. We are pre-seed with 40 users and a working MVP.',
    industry: 'FinTech',
    teamNeeded: ['React', 'Node.js', 'Marketing'],
    equity: '5-10%',
    applicants: 14,
    fundingNeeded: '$250K',
    teamSize: 3,
    match: 92,
  },
  {
    id: 's2',
    name: 'MediCare',
    tagline: 'Telehealth consultations in rural India',
    description: 'Connecting patients in underserved areas with certified doctors via a lightweight mobile app.',
    industry: 'HealthTech',
    teamNeeded: ['Android', 'AI/ML', 'Product Management'],
    equity: '3-8%',
    applicants: 9,
    fundingNeeded: '$500K',
    teamSize: 5,
    match: 84,
  },
  {
    id: 's3',
    name: 'EduNova',
    tagline: 'Micro-learning platform for working professionals',
    description: 'Bite-sized courses with AI-generated practice questions. 1,200 registered beta users.',
    industry: 'EdTech',
    teamNeeded: ['React', 'iOS', 'Content Writing'],
    equity: '4-7%',
    applicants: 11,
    fundingNeeded: '$150K',
    teamSize: 2,
    match: 78,
  },
]

export const mockApplications: Application[] = [
  { id: 'a1', startup: 'FinTrack', applicant: 'Priya Sharma', role: 'Full-Stack Developer', match: 94, status: 'shortlisted', time: '2h ago' },
  { id: 'a2', startup: 'FinTrack', applicant: 'Arjun Mehta', role: 'Product Designer', match: 87, status: 'pending', time: '5h ago' },
  { id: 'a3', startup: 'FinTrack', applicant: 'Sara Khan', role: 'Growth Marketer', match: 81, status: 'pending', time: '1d ago' },
  { id: 'a4', startup: 'MediCare', applicant: 'Rahul Verma', role: 'Backend Engineer', match: 76, status: 'rejected', time: '2d ago' },
]

export const mockMessages: Message[] = [
  { id: 'm1', sender: 'Priya Sharma', preview: 'Hi! I would love to join FinTrack. I have 5 years of React experience...', time: '10:24', unread: true },
  { id: 'm2', sender: 'Ankit Patel', preview: 'Sent you the investor deck you asked for...', time: '09:12', unread: true },
  { id: 'm3', sender: 'Neha Gupta', preview: 'Great meeting today! Lets sync next week...', time: 'Yesterday', unread: true },
  { id: 'm4', sender: 'Vikram Singh', preview: 'Could you review the terms sheet?', time: 'Yesterday', unread: false },
]

export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'application', text: 'Priya Sharma applied to FinTrack', time: '2h ago', read: false },
  { id: 'n2', type: 'message', text: 'New message from Ankit Patel', time: '4h ago', read: false },
  { id: 'n3', type: 'milestone', text: 'Your profile reached 120 views this week', time: '1d ago', read: false },
  { id: 'n4', type: 'application', text: 'Sara Khan was shortlisted by MediCare', time: '2d ago', read: true },
]

export const recommendedForRole: Record<Role, Startup[]> = {
  founder: [mockStartups[0], mockStartups[1], mockStartups[2]],
  developer: [mockStartups[0], mockStartups[1], mockStartups[2]],
  designer: [mockStartups[0], mockStartups[1], mockStartups[2]],
  investor: [mockStartups[0], mockStartups[1], mockStartups[2]],
  marketer: [mockStartups[0], mockStartups[1], mockStartups[2]],
  legal_advisor: [mockStartups[0], mockStartups[1], mockStartups[2]],
  business_analyst: [mockStartups[0], mockStartups[1], mockStartups[2]],
  mentor: [mockStartups[0], mockStartups[1], mockStartups[2]],
  recruiter: [mockStartups[0], mockStartups[1], mockStartups[2]],
  administrator: [mockStartups[0], mockStartups[1], mockStartups[2]],
}
