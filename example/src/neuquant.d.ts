/**
 * NeuQuant Neural-Network Quantization Algorithm
 *
 * Copyright (c) 1994 Anthony Dekker
 *
 * See "Kohonen neural networks for optimal colour quantization" in "Network:
 * Computation in Neural Systems" Vol. 5 (1994) pp 351-367. for a discussion of
 * the algorithm.
 *
 * See also http://members.ozemail.com.au/~dekker/NEUQUANT.HTML
 *
 * Any party obtaining a copy of these files from the author, directly or
 * indirectly, is granted, free of charge, a full and unrestricted irrevocable,
 * world-wide, paid up, royalty-free, nonexclusive right and license to deal in
 * this software and documentation files (the "Software"), including without
 * limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons who
 * receive copies from any such party to do so, with the only requirement being
 * that this copyright notice remain intact.
 *
 * Copyright (c) 2012 Johan Nordberg (JavaScript port)
 * Copyright (c) 2014 Devon Govett (JavaScript port)
 */
export default class NeuQuant {
    constructor(pixels: number[], options: {
        ncycles?: number;
        netsize?: number;
        samplefac?: number;
    });
    [k: string]: any;
    unbiasnet(): void;
    altersingle(alpha: any, i: any, b: any, g: any, r: any): void;
    alterneigh(radius: any, i: any, b: any, g: any, r: any): void;
    contest(b: any, g: any, r: any): number;
    inxbuild(): void;
    learn(): void;
    buildColorMap(): void;
    getColorMap(): Uint8Array;
}
