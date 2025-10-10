

export enum Tab {
  Slicing = 'Slicing',
  Projecting = 'Projecting',
  Advanced = 'Advanced',
}

export type PrintMode = 'velocity' | 'hops' | 'time-per-frame';

export type SlicingStatus = 'idle' | 'slicing' | 'complete' | 'failed';

export interface SlicingStats {
  time: number | null;
  count: number | null;
}

export interface SlicingParams {
  voxelSize: number;
  numProjections: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

export interface ProjectionParams {
  totalRotation: number;
  rotationSpeed: number;
  pauseAfterRotation: number;
  verticalSteps: number;
  verticalDelay: number;
  verticalDirection: number;
}

export interface AlignmentParams {
  scale: number;
  translateX: number;
  translateY: number;
  contrast: number;
}

// Fix: Centralized Web Bluetooth API type definitions to resolve declaration conflicts.
// These are minimal type definitions to satisfy the compiler for Web Bluetooth API usage
// when the `@types/web-bluetooth` package is not available.
export interface BluetoothDevice extends EventTarget {
  gatt?: BluetoothRemoteGATTServer;
}

export interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
  disconnect(): void;
}

export interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

export interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  writeValue(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}

export interface Bluetooth {
  requestDevice(options?: any): Promise<BluetoothDevice>;
}

// Augment the global Navigator interface to include the 'bluetooth' property
declare global {
  interface Navigator {
    bluetooth: Bluetooth;
  }
}

// Add Presentation API types to satisfy compiler
export interface PresentationConnection extends EventTarget {
    state: 'connecting' | 'connected' | 'closed' | 'terminated';
    send(message: string): void;
    terminate(): void;
    onclose: ((this: PresentationConnection, ev: Event) => any) | null;
    onmessage: ((this: PresentationConnection, ev: MessageEvent) => any) | null;
    onterminate: ((this: PresentationConnection, ev: Event) => any) | null;
}

export interface PresentationConnectionAvailableEvent extends Event {
    readonly connection: PresentationConnection;
}

export interface PresentationRequest extends EventTarget {
    start(): Promise<PresentationConnection>;
    onconnectionavailable: ((this: PresentationRequest, ev: PresentationConnectionAvailableEvent) => any) | null;
}

export interface PresentationConnectionList extends EventTarget {
    connections: readonly PresentationConnection[];
    onconnectionavailable: ((this: PresentationConnectionList, ev: PresentationConnectionAvailableEvent) => any) | null;
}

export interface PresentationReceiver {
    readonly connectionList: Promise<PresentationConnectionList>;
}

declare global {
  interface Navigator {
    presentation?: {
        receiver?: PresentationReceiver;
        defaultRequest?: PresentationRequest;
    };
  }
  var PresentationRequest: {
      prototype: PresentationRequest;
      new(urls: string[]): PresentationRequest;
  };
}