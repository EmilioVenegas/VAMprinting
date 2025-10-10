// Fix: Removed duplicate Web Bluetooth API type definitions. They are now centralized in types.ts to resolve declaration conflicts.
import type { BluetoothDevice, BluetoothRemoteGATTCharacteristic, BluetoothRemoteGATTServer } from '../types';


const SERVICE_UUID = "1e8d1feb-8ee1-49c7-88f2-d2e8d5fc210d";
const CHARACTERISTIC_UUID = "383beeb8-0543-4f0d-b71c-3de982151224";

class BLEService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  async connect(onDisconnect: () => void): Promise<BluetoothRemoteGATTCharacteristic> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth API is not available in this browser.");
    }

    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ name: "phoneVam" }],
      optionalServices: [SERVICE_UUID],
    });

    if (!this.device) {
      throw new Error("No device selected.");
    }
    
    this.device.addEventListener('gattserverdisconnected', onDisconnect);

    this.server = await this.device.gatt?.connect();
    if (!this.server) {
      throw new Error("Failed to connect to GATT server.");
    }

    const service = await this.server.getPrimaryService(SERVICE_UUID);
    this.characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

    if (!this.characteristic) {
        throw new Error("Characteristic not found.");
    }

    return this.characteristic;
  }

  async writeData(data: Float32Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error("Not connected to any characteristic.");
    }
    await this.characteristic.writeValue(data.buffer);
  }

  disconnect() {
    this.server?.disconnect();
    this.device = null;
    this.server = null;
    this.characteristic = null;
  }
}

export const bleService = new BLEService();