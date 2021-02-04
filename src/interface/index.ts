declare namespace LiGif {

    export enum DisplayEnum {
        default = 0,
        cover  = 1
    }

    export interface IFrame {

        /**
         * 原点x轴坐标
         *
         * @type {number}
         * @memberof IFrame
         */
        x: number;

        /**
         * 原点y轴坐标
         *
         * @type {number}
         * @memberof IFrame
         */
        y: number;

        /**
         * 图像宽度
         *
         * @type {number}
         * @memberof IFrame
         */
        w: number;

        /**
         * 图像高度
         *
         * @type {number}
         * @memberof IFrame
         */
        h: number;

        /**
         * 颜色深度
         *
         * @type {number}
         * @memberof IFrame
         */
        colorDepth: number;

        /**
         * 是否使用全局调色板
         *
         * @type {boolean}
         * @memberof IFrame
         */
        isGlobalPalette: boolean;

        /**
         * 透明色索引
         *
         * @type {number}
         * @memberof IFrame
         */
        transparentColorIndex?: number;

        /**
         * 是否隔行排列像素
         *
         * @type {boolean}
         * @memberof IFrame
         */
        isInterlace: boolean;

        /**
         * 调色板数据
         *
         * @type {number[]}
         * @memberof IFrame
         */
        palette?: number[];

        /**
         * 帧像素
         *
         * @type {number[]}
         * @memberof IFrame
         */
        pixels: Uint8Array;

        /**
         * 显示延时时间 单位: ms(10的倍数 比如 147 会转成 140)
         *
         * @type {number}
         * @memberof IFrame
         */
        delay: number;


    }


    export interface IEncodeFrame extends IFrame {
        /**
         * 像素(pixels)对应在调色板(palette)的颜色索引数据
         *
         * @type {number[]}
         * @memberof IEncodeFrame
         */
        indexs: number[];

        /**
         * 颜色是否压缩过
         *
         * @type {boolean}
         * @memberof IEncodeFrame
         */
        isZip: boolean;


        /**
         * 是否有透明色
         *
         * @type {boolean}
         * @memberof IDecodeFrame
         */
        hasTransparenc: boolean;
    }


    export interface IDecodeFrame extends IFrame {
        /**
         * 图像编码数据
         *
         * @type {number[]}
         * @memberof IDecodeFrame
         */
        imgData: number[];

        /**
         * 展示方式
         *
         * @type {DisplayEnum}
         * @memberof IFrame
         */
        displayType: DisplayEnum;

        /**
         * 上一帧
         *
         * @type {IDecodeFrame}
         * @memberof IDecodeFrame
         */
        preFrame?: IDecodeFrame;

    }
}
