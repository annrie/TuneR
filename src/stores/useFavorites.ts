import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import type { Station } from '../types'

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = useLocalStorage<Station[]>('radio-favorites', [])

  const isFavorite = (station: Station) => {
    return favorites.value.some(s => s.stationuuid === station.stationuuid)
  }

  const addFavorite = (station: Station) => {
    if (!isFavorite(station)) {
      favorites.value.push(station)
    }
  }

  const removeFavorite = (station: Station) => {
    favorites.value = favorites.value.filter(s => s.stationuuid !== station.stationuuid)
  }

  const toggleFavorite = (station: Station) => {
    if (isFavorite(station)) {
      removeFavorite(station)
    } else {
      addFavorite(station)
    }
  }

  return { favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite }
})
