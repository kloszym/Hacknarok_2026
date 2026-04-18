#!/usr/bin/env python3
"""
Simple icon generator for Chrome extension
Creates PNG icons in sizes 16x16, 48x48, and 128x128
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Installing Pillow...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw, ImageFont

import os

def create_icon(size):
    # Create image with gradient background
    img = Image.new('RGB', (size, size), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw gradient background (purple)
    for y in range(size):
        r = int(102 + (118 - 102) * y / size)
        g = int(126 + (75 - 126) * y / size)
        b = int(234 + (162 - 234) * y / size)
        draw.rectangle([(0, y), (size, y+1)], fill=(r, g, b))
    
    # Draw magnifying glass
    center_x = size // 2 - size // 8
    center_y = size // 2 - size // 8
    radius = size // 3
    
    # Glass circle (white)
    draw.ellipse(
        [(center_x - radius, center_y - radius), 
         (center_x + radius, center_y + radius)],
        outline='white',
        width=max(2, size // 16)
    )
    
    # Handle
    handle_start_x = center_x + int(radius * 0.7)
    handle_start_y = center_y + int(radius * 0.7)
    handle_end_x = center_x + int(radius * 1.5)
    handle_end_y = center_y + int(radius * 1.5)
    
    draw.line(
        [(handle_start_x, handle_start_y), (handle_end_x, handle_end_y)],
        fill='white',
        width=max(2, size // 16)
    )
    
    # Checkmark inside glass
    check_size = radius // 2
    check_x = center_x - check_size // 3
    check_y = center_y
    
    draw.line(
        [(check_x - check_size//3, check_y), 
         (check_x, check_y + check_size//2)],
        fill='white',
        width=max(2, size // 20)
    )
    draw.line(
        [(check_x, check_y + check_size//2), 
         (check_x + check_size//2, check_y - check_size//3)],
        fill='white',
        width=max(2, size // 20)
    )
    
    return img

# Create icons directory if it doesn't exist
icons_dir = os.path.join(os.path.dirname(__file__), 'icons')
os.makedirs(icons_dir, exist_ok=True)

# Generate icons
sizes = [16, 48, 128]
for size in sizes:
    icon = create_icon(size)
    icon.save(os.path.join(icons_dir, f'icon{size}.png'))
    print(f"Created icon{size}.png")

print("All icons created successfully!")
