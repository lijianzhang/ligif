import LzwDecode from '../lzw-decode';

export function decodeToPixels(
    imgData: number[], colorDepth: number, palette: number[], transparentColorIndex?: number, isInterlace?: boolean
    ) {
    const decode = new LzwDecode(colorDepth);
    const data = decode.decode(Uint8Array.from(imgData));
    const pixels = [];
    if (!isInterlace) {
        data.forEach((k) => {
            pixels.push(palette[k * 3]);
            pixels.push(palette[k * 3 + 1]);
            pixels.push(palette[k * 3 + 2]);
            pixels.push(k === transparentColorIndex ? 0 : 255);
        });
    } else {
        const start = [0, 4, 2, 1];
        const inc = [8, 8, 4, 2];
        let index = 0;
        for (let pass = 0; pass < 4; pass += 1) {
            for (let i = start[pass]; i < h; i += inc[pass]) {
                for (let j = 0; j < w; j += 1) {
                    const idx = (i - 1) * w * 4 + j * 4;
                    const k = data[index];
                    pixels[idx] = palette[k * 3];
                    pixels[idx + 1] = palette[k * 3 + 1];
                    pixels[idx + 2] = palette[k * 3 + 2];
                    pixels[idx + 3] = k === transparentColorIndex ? 0 : 255;
                    index += 1;
                }
            }
        }
    }

    return pixels;
}

const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.onmessage = (e) => {
    const data = decodeToPixels(e.data.imgData, e.data.colorDepth, e.data.palette, e.data.transparentColorIndex. e.data.isInterlace);
    ctx.postMessage(data);
};
