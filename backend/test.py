# test_connection.py
import usb.core
import usb.util

# Vendor and Product ID for your DLP projector
VENDOR_ID = 0x0451
PRODUCT_ID = 0x6401

print("Searching for DLP projector...")

# Find our device
dev = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID)

# Was it found?
if dev is None:
    print("\n---FAILURE---")
    print("Device not found. Please check:")
    print("1. Is the projector plugged in and powered on?")
    print("2. Did you run Zadig correctly for the device with ID 0451:6401?")
    print("3. Is 'libusb-1.0.dll' in the same folder as this script?")
    raise ValueError('Device not found')

print("\n---SUCCESS---")
print("Device found!")
print(dev)