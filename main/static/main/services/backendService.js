import Cookies from 'js-cookie';
import { UiError } from '../modules/errorHandler.js';

export default class BackendService {

    constructor() {
    }

    parseResponse(res, errorMessageTemplate, fatal) {
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

    postAction(url, action, params) {
        let formData = new FormData();
        formData.append('csrfmiddlewaretoken', Cookies.get('csrftoken'));
        formData.append('action', action);
        if (params) {
            for (const [key, val] of Object.entries(params)) {
                formData.append(key, val);
            }
        }
        return fetch(url, { method: 'POST', body: formData })
            .then(res => this.parseResponse(res, `Could not execute action "${action}"`, false));
    }

}