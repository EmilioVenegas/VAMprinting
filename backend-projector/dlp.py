import usb.core
import usb.util
from usb.core import USBError

from pycrafter4500 import bits_to_bytes, conv_len
from time import sleep, perf_counter
import numpy as np


class dlpc350(object):
    def __init__(self):
        self.connected = False

    def Connect(self):
        if self.connected == False:
            #try:
            self.dlp = usb.core.find(idVendor = 0x0451, idProduct = 0x6401) # DLPC 0451, 6401
            
            self.dlp.set_configuration()
            self.disable_LEDs()
            self.connected = True
            sleep(1)
            print("DLPC350 connection succesfull")
            #except:
            #    print('No DLP device found, please check the connection')
            #    self.connected = False
            
    def command(self,
                mode,
                sequence_byte,
                com1,
                com2,
                data=None):
        """
        Sends a command to the dlpc.

        :param str mode: Whether reading or writing.
        :param int sequence_byte:
        :param int com1: Command 1
        :param int com2: Command 3
        :param list data: Data to pass with command.
        """

        buffer = []

        if mode == 'r':
            flagstring = 0xc0  # 0b11000000
        else:
            flagstring = 0x40  # 0b01000000

        data_len = conv_len(len(data) + 2, 16)
        data_len = bits_to_bytes(data_len)

        buffer.append(flagstring)
        buffer.append(sequence_byte)
        buffer.extend(data_len)
        buffer.append(com2)
        buffer.append(com1)

        # if data fits into single buffer, write all and fill
        if len(buffer) + len(data) < 65:
            for i in range(len(data)):
                buffer.append(data[i])

            # append empty data to fill buffer
            for i in range(64 - len(buffer)):
                buffer.append(0x00)

            self.dlp.write(1, buffer)

        # else, keep filling buffer and pushing until data all sent
        else:
            for i in range(64 - len(buffer)):
                buffer.append(data[i])

            self.dlp.write(1, buffer)
            buffer = []

            j = 0
            while j < len(data) - 58:
                buffer.append(data[j + 58])
                j += 1

                if j % 64 == 0:
                    self.dlp.write(1, buffer)
                    buffer = []

            if j % 64 != 0:
                while j % 64 != 0:
                    buffer.append(0x00)
                    j += 1

                self.dlp.write(1, buffer)

        # wait a bit between commands
        # time.sleep(0.02)
        # time.sleep(0.02)

        # done writing, read feedback from dlpc
        try:
            self.ans = self.dlp.read(0x81, 64) # For DLPC350 0x81, for DLP47010 0x82
        except USBError as e:
            print('USB Error:', e)

        sleep(0.02)

    def read_reply(self):
        """
        Reads in reply.
        """
        for i in self.ans:
            print(hex(i))


    def set_current_RGB(self, red:int, green:int, blue: int) -> None:
        """
        Set the current for the projector 

        Args:
            red (int): _description_
            green (int): _description_
            blue (int): _description_
        """
        byte0 = np.binary_repr(red).zfill(8)
        byte1 = np.binary_repr(green).zfill(8)
        byte2 = np.binary_repr(blue).zfill(8)
        
        payload = bits_to_bytes(byte2 + byte1 + byte0)
        
        self.command('w', 0x00, 0x1A, 0x05, [0b1])
        self.command('w', 0x00, 0x0B, 0x01, payload)
    

    def enable_LEDs(self, red:bool, green:bool, blue: bool) -> None:
        payload = bits_to_bytes(f'{int(blue)}{int(green)}{int(red)}')
    
        self.command('w', 0x00, 0x1A, 0x07, payload)
    
    def disable_LEDs(self) -> None:
        self.command('w', 0x00, 0x1A, 0x07, [0b000])
    

    def run_projection(self, blue: bool, green: bool, red: bool,
                        red_c:int, green_c:int, blue_c: int,
                        time:float) -> None:
    
        self.set_current_RGB(red_c, green_c, blue_c)
        self.enable_LEDs(red, green, blue)
        
        t0 = perf_counter()
        
        while perf_counter() - t0 < time:
            pass
            
        self.disable_LEDs()
    
