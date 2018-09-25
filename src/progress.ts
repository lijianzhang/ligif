export default class Progress {

    get done() {
        return this._done || this.step >= this.total;
    }

    get percent() {
        return Math.floor(this.step / (this.total || 1) * 100);
    }

    get status() {
        if (this.error) { return 'exception'; }
        if (this.total === 0) { return 'active'; }
        return this.done ? 'success' : 'active';
    }

    get step() {
        return this._step;
    }

    set step(value) {
        if (this.error) { return; }
        this._step = value;
        this._done = false;
        if (this._step > this.total) {
            this._done = true;
            this._total = this._step;
        }
    }

    get total() {
        return this._total;
    }

    set total(value) {
        this._total = value;
        if (this._step > this.total) {
            this._done = true;
            this._total = this._step;
        }
    }

    public message = '';

    public error = '';

    private _total = 0;

    private _done: boolean;

    private _step = 0;

    public end() {
        this._done = true;
    }

    public addStep(step = 1) {
        this.step += step;
    }

    public addTotal(total = 0) {
        this.total += total;
        this._done = false;
    }

    public reset() {
        this.total = 0;
        this.step = 0;
        this.error = '';
        this.message = '';
    }
}
