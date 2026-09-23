"""Step 1: matte him out of the photograph.

Runs BiRefNet-portrait (the ONNX export rembg publishes) directly on onnxruntime: once on the
whole picture, once closer in on his head and shoulders for sharper edges there, blended.

Writes work/master.png (the source at MASTER px) and work/alpha.png.
Usage: python segment.py [source image]
"""
import os
import sys
import time

import numpy as np
import onnxruntime as ort
import pooch
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, 'work')
SOURCE = 'C:/Users/daodi/Downloads/1000045176_upscayl_5x_upscayl-standard-4x.png'
MASTER = 2400
MODEL_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-portrait-epoch_150.onnx'
MODEL_MD5 = 'md5:c3a64a6abf20250d090cd055f12a3b67'
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def predict(sess, img):
    """rembg's BiRefNet pre- and post-processing; returns a float mask at img.size."""
    a = np.asarray(img.convert('RGB').resize((1024, 1024), Image.LANCZOS), np.float32)
    a = (a / max(a.max(), 1e-6) - MEAN) / STD
    t = time.time()
    out = sess.run(None, {sess.get_inputs()[0].name: a.transpose(2, 0, 1)[None].astype(np.float32)})[0][:, 0]
    print('  inference', round(time.time() - t, 1), 's')
    pred = 1 / (1 + np.exp(-out))
    pred = (pred - pred.min()) / (pred.max() - pred.min())
    m = Image.fromarray((np.squeeze(pred) * 255).astype(np.uint8)).resize(img.size, Image.BICUBIC)
    return np.clip(np.asarray(m, np.float32) / 255, 0, 1)


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else SOURCE
    os.makedirs(WORK, exist_ok=True)
    model = pooch.retrieve(MODEL_URL, MODEL_MD5, fname='birefnet-portrait.onnx', path=os.path.join(HERE, 'models'))
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = os.cpu_count() or 4
    sess = ort.InferenceSession(model, opts, providers=['CPUExecutionProvider'])

    master = Image.open(source).convert('RGB').resize((MASTER, MASTER), Image.LANCZOS)
    master.save(os.path.join(WORK, 'master.png'))

    print('whole picture')
    full = predict(sess, master)
    x0, y0, side = int(0.20 * MASTER), int(0.06 * MASTER), int(0.60 * MASTER)
    print('head and shoulders')
    head = predict(sess, master.crop((x0, y0, x0 + side, y0 + side)))

    # Blend the closer pass in, feathered away from the crop's edges.
    f = int(0.06 * side)
    ramp = np.ones(side, np.float32)
    ramp[:f] = np.linspace(0, 1, f)
    ramp[-f:] = np.linspace(1, 0, f)
    w = np.minimum.outer(ramp, ramp)
    alpha = full.copy()
    alpha[y0:y0 + side, x0:x0 + side] = w * head + (1 - w) * full[y0:y0 + side, x0:x0 + side]
    Image.fromarray((alpha * 255).astype(np.uint8)).save(os.path.join(WORK, 'alpha.png'))
    print('wrote work/master.png, work/alpha.png')


if __name__ == '__main__':
    main()
