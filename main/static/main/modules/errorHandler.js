export class ErrorState {
    constructor() {
        this.clear();
    }

    clear() {
        this.error = false;
        this.messages = [];
        this.fatal = false;
    }

    addError(msg, fatal) {
        if (this.error) {
            this.messages.push(msg);
            if (fatal) {
                this.fatal = true;
            }
        } else {
            this.error = true;
            this.messages = [msg];
            this.fatal = fatal;
        }
    }
}

export class UiError {
    constructor(msg, fatal) {
        this.msg = msg;
        this.fatal = fatal;
    }
}

export function parseResponse(res, errorMessageTemplate, fatal) {
    if (res.ok) {
        return res.json();
    } else {
        const contentType = res.headers.get('content-type');
        if(contentType && contentType.includes('application/json')) {
            return res.json()
                .catch(err => {
                    throw new UiError(`${errorMessageTemplate}: ${err}`, fatal)
                })
                .then(json => {
                    if ('message' in json) {
                        throw new UiError(`${errorMessageTemplate}: ${json.message}`, fatal);
                    } else if('detail' in json) {
                        throw new UiError(`${errorMessageTemplate}: ${json.detail}`, fatal);
                    } else {
                        throw new UiError(`${errorMessageTemplate}: ${json}`, fatal)
                    }
                });
        } else {
            throw new UiError(`${errorMessageTemplate}: ${res.statusText}`, fatal)
        }
    }
}

export default {
    template: `
        <slot />
        <modal :showModal="errorState.error" @ok="errorState.clear()" @cancel="errorState.clear()" :closable="!errorState.fatal" :cancellable="false">
            <template v-slot:header>
                <h3 class="error">An error happened</h3>
            </template>
            <template v-slot:body>
                <ul v-if="errorState.messages.length > 1">
                    <li v-for="msg in errorState.messages">{{ msg }}</li>                      
                </ul>
                <span v-else>{{ errorState.messages[0] }}</span>
            </template>
        </modal>
    `,
    data() {
        return {
            errorState: new ErrorState()
        }
    },
    errorCaptured(error) {
        console.log('got an error here!', error);
        let msg;
        if('msg' in error) {
            msg = error.msg;
        } else if('message' in error) {
            msg = error.message;
        } else {
            msg = error.toString();
        }
        this.errorState.addError(msg, error.fatal);
        return false;
    }
}