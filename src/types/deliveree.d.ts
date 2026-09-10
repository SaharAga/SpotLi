/**
 * Deliveree TypeScript Type Definitions
 * 
 * Core domain types, carrier models, lifecycle stages, category classifications,
 * Cloud Storage interfaces, and Auth contracts for Deliveree package tracker.
 */

/**
 * Valid delivery stage / status identifiers
 */
export type DeliveryStageId =
  | 'ordered'
  | 'shipped'
  | 'in_transit'
  | 'customs'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned_to_sender'
  | 'archived';

/**
 * Supported carrier identifiers
 */
export type CarrierId =
  | 'israel-post'
  | 'chita'
  | 'hfd'
  | 'boxit'
  | 'cainiao'
  | 'yunexpress'
  | '4px'
  | 'dhl'
  | 'fedex'
  | 'ups'
  | 'usps'
  | 'royal-mail'
  | 'aramex'
  | 'yanwen'
  | 'gaash'
  | 'other';

/**
 * Category classification identifiers
 */
export type CategoryId =
  | 'electronics'
  | 'clothing'
  | 'home'
  | 'health'
  | 'work'
  | 'gifts'
  | 'other';

/**
 * Individual tracking milestone / checkpoint
 */
export interface Checkpoint {
  id: string;
  title: string;
  titleHe?: string;
  description?: string;
  descriptionHe?: string;
  location?: string;
  timestamp: string;
  isCompleted: boolean;
}

/**
 * Full Package entity
 */
export interface Package {
  id: string;
  title: string;
  titleHe?: string;
  trackingNumber: string;
  carrier: CarrierId | string;
  carrierName?: string;
  status: DeliveryStageId;
  category: CategoryId | string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  origin?: string;
  destination?: string;
  notes?: string;
  notesHe?: string;
  isPinned: boolean;
  isArchived: boolean;
  shelfNumber?: string;
  localTrackingNumber?: string;
  localCarrier?: string;
  aliases?: string[];
  customsDetails?: {
    amount?: number;
    paymentUrl?: string;
    isCleared?: boolean;
    declarationNumber?: string;
    handler?: string;
  };
  checkpoints: Checkpoint[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

/**
 * Input type for creating or editing a package
 */
export interface PackageInput {
  id?: string;
  title: string;
  titleHe?: string;
  trackingNumber: string;
  carrier?: CarrierId | string;
  carrierName?: string;
  status?: DeliveryStageId;
  category?: CategoryId | string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  origin?: string;
  destination?: string;
  notes?: string;
  notesHe?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  shelfNumber?: string;
  localTrackingNumber?: string;
  localCarrier?: string;
  aliases?: string[];
  customsDetails?: {
    amount?: number;
    paymentUrl?: string;
    isCleared?: boolean;
    declarationNumber?: string;
    handler?: string;
  };
  checkpoints?: Checkpoint[];
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

/**
 * Carrier definition with regex matching patterns and tracking link formatters
 */
export interface CarrierDefinition {
  id: CarrierId | string;
  name: string;
  hebrewName: string;
  color: string;
  badgeBg: string;
  accentColor: string;
  logoText: string;
  website: string;
  getTrackingUrl: (trackNum: string) => string;
  fallbackTrackingUrl: (trackNum: string) => string;
  patterns: RegExp[];
  sample: string;
  country: string;
}

/**
 * Delivery stage definition
 */
export interface StageDefinition {
  id: DeliveryStageId;
  key: string;
  order: number;
  label: string;
  hebrewLabel: string;
  desc: string;
  hebrewDesc: string;
  color: string;
  badgeClass: string;
}

/**
 * Category definition
 */
export interface CategoryDefinition {
  id: CategoryId | string;
  label: string;
  hebrewLabel: string;
  icon: string;
  color: string;
}

/**
 * Authenticated User profile contract
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  ingestionEmail: string;
  plan: string;
  devicesCount: number;
  createdAt: string;
}

/**
 * Cloud Storage Adapter interface for multi-tier persistence
 */
export interface CloudStorageAdapterInterface {
  mode: 'firestore' | 'local' | string;
  userId: string | null;
  setUserId(userId: string | null): void;
  setMode(mode: 'firestore' | 'local' | string): void;
  isFirestoreActive(): boolean;
  initFirestoreListener(): void;
  getPackages(): Promise<Package[]>;
  savePackages(packages: Package[]): Promise<Package[]>;
  upsertPackage(pkg: PackageInput | Package): Promise<Package[]>;
  deletePackage(packageId: string): Promise<Package[]>;
  subscribe(callback: (packages: Package[]) => void): () => void;
  notifyListeners(data: Package[]) : void;
  teardown(): void;
}

/**
 * System metadata and release version constants
 */
export type BuildChannel = 'alpha' | 'beta' | 'rc' | 'production';

export declare const APP_VERSION: string;
export declare const RELEASE_DATE: string;
export declare const BUILD_CHANNEL: BuildChannel;
export declare const FIREBASE_SCHEMA_VERSION: string;
