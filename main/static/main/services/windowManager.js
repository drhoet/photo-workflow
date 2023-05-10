export default class WindowManager {
    constructor() {
        this.stack = [];
        document.addEventListener('keydown', (e) => this.onKeyDown(e, this.getFocusedWindow()));
        document.addEventListener('keyup', (e) => this.onKeyUp(e, this.getFocusedWindow()));
    }

    opened(w) {
        this.stack.push(w);
    }

    closed(w) {
        if(this.hasFocus(w)) {
            this.stack.pop();
        } else {
            console.error("Cannot close window that does not have focus", w);
            throw "Cannot close window that does not have focus";
        }
    }

    hasFocus(w) {
        return this.stack[this.stack.length - 1] === w;
    }

    getFocusedWindow() {
        return this.stack[this.stack.length - 1];
    }

    onKeyDown(e, w) {
        if(w && w.onKeyDown) {
            w.onKeyDown(e);
        }
    }

    onKeyUp(e, w) {
        if(w && w.onKeyUp) {
            w.onKeyUp(e);
        }
    }
}
