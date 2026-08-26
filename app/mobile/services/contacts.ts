import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contact } from '../types/contact';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { getWalletSession } from './wallet-session';

const CONTACTS_KEY = 'contacts';
const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');

async function getOwnerPublicKey(): Promise<string | null> {
  const session = await getWalletSession();
  return session?.publicKey ?? null;
}

async function getCachedContacts(): Promise<Contact[]> {
  const data = await AsyncStorage.getItem(CONTACTS_KEY);
  return data ? JSON.parse(data) : [];
}

async function cacheContacts(contacts: Contact[]): Promise<void> {
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message ?? `Contacts request failed (${response.status})`);
  return payload as T;
}

export async function getContacts(): Promise<Contact[]> {
  const netInfo = await NetInfo.fetch();
  const ownerPublicKey = await getOwnerPublicKey();
  if (ownerPublicKey && netInfo.isConnected !== false) {
    try {
      const result = await apiRequest<{ contacts: Contact[] }>(
        `/contacts?ownerPublicKey=${encodeURIComponent(ownerPublicKey)}`,
      );
      await cacheContacts(result.contacts);
      return result.contacts;
    } catch (error) {
      console.warn('Failed to sync contacts with backend, using local cache', error);
    }
  }
  return getCachedContacts();
}

export async function saveContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
  const newContact: Contact = {
    ...contact,
    id: Crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const netInfo = await NetInfo.fetch();
  const ownerPublicKey = await getOwnerPublicKey();
  if (ownerPublicKey && netInfo.isConnected !== false) {
    try {
      const result = await apiRequest<{ contact: Contact }>('/contacts', {
        method: 'POST',
        body: JSON.stringify({ ownerPublicKey, contact: newContact }),
      });
      const contacts = await getCachedContacts();
      await cacheContacts([result.contact, ...contacts.filter((item) => item.id !== result.contact.id)]);
      return result.contact;
    } catch (error) {
      console.warn('Failed to save contact remotely, keeping local copy', error);
    }
  }
  const contacts = await getCachedContacts();
  await cacheContacts([newContact, ...contacts]);
  return newContact;
}

export async function updateContact(updated: Contact): Promise<void> {
  const netInfo = await NetInfo.fetch();
  const ownerPublicKey = await getOwnerPublicKey();
  if (ownerPublicKey && netInfo.isConnected !== false) {
    try {
      const result = await apiRequest<{ contact: Contact }>(`/contacts/${encodeURIComponent(updated.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ownerPublicKey, contact: updated }),
      });
      const contacts = await getCachedContacts();
      await cacheContacts(contacts.map((contact) => contact.id === updated.id ? result.contact : contact));
      return;
    } catch (error) {
      console.warn('Failed to update contact remotely, keeping local copy', error);
    }
  }
  const contacts = await getCachedContacts();
  const next = contacts.map(c => c.id === updated.id ? { ...updated, updatedAt: Date.now() } : c);
  await cacheContacts(next);
}

export async function deleteContact(id: string): Promise<void> {
  const netInfo = await NetInfo.fetch();
  const ownerPublicKey = await getOwnerPublicKey();
  if (ownerPublicKey && netInfo.isConnected !== false) {
    try {
      await apiRequest(`/contacts/${encodeURIComponent(id)}?ownerPublicKey=${encodeURIComponent(ownerPublicKey)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.warn('Failed to delete contact remotely, deleting local copy', error);
    }
  }
  const contacts = await getCachedContacts();
  const next = contacts.filter(c => c.id !== id);
  await cacheContacts(next);
}
