from time import time, sleep
from dlp import *

projector = dlpc350()   
projector.Connect()


#This changes which light is on/off
green = False
blue = False 
UV = True

#0 - 255  This changes light intensity
greenCurrent = 0
blueCurrent = 0
UVCurrent = 45

projector.set_current_RGB(UVCurrent, greenCurrent, blueCurrent)
sleep(7) #This changes the time you have to change screens

start_time = time()




projector.enable_LEDs(UV, green, blue)


    
projector.disable_LEDs()

