/**
 * Notes Plugin API Client
 */

import { api } from "./api"

export interface NoteDTO {
  id: number
  title: string
  content: string | null
  createdAt: string
  updatedAt: string
}

export interface PluginStatusDTO {
  pluginId: string
  enabled: boolean
  version: string
  installedAt?: string
  config?: Record<string, unknown>
}

export const notesApi = {
  // Plugin management
  async getPluginStatus(): Promise<PluginStatusDTO> {
    const response = await api.get<PluginStatusDTO>("/api/v1/plugins/notes/status")
    if (!response.data) throw new Error("Failed to get plugin status")
    return response.data
  },

  async enablePlugin(): Promise<void> {
    await api.post("/api/v1/plugins/notes/enable", {})
  },

  async disablePlugin(): Promise<void> {
    await api.post("/api/v1/plugins/notes/disable", {})
  },

  // Notes CRUD
  async list(): Promise<NoteDTO[]> {
    const response = await api.get<NoteDTO[]>("/api/v1/apps/notes/notes")
    return response.data || []
  },

  async get(id: number): Promise<NoteDTO> {
    const response = await api.get<NoteDTO>(`/api/v1/apps/notes/notes/${id}`)
    if (!response.data) throw new Error("Failed to get note")
    return response.data
  },

  async create(data: { title: string; content?: string }): Promise<NoteDTO> {
    const response = await api.post<NoteDTO>("/api/v1/apps/notes/notes", data)
    if (!response.data) throw new Error("Failed to create note")
    return response.data
  },

  async update(id: number, data: { title?: string; content?: string }): Promise<NoteDTO> {
    const response = await api.put<NoteDTO>(`/api/v1/apps/notes/notes/${id}`, data)
    if (!response.data) throw new Error("Failed to update note")
    return response.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/apps/notes/notes/${id}`)
  },
}
