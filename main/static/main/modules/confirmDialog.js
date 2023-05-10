export default {
    template: `
        <modal v-if="showModal" @ok="ok" @cancel="cancel" id="confirm-modal">
            <template v-slot:header>
                <h3>{{ title }}</h3>
            </template>
            <template v-slot:body>
                <div v-html="message"></div>
            </template>
        </modal>
    `,
    data() {
        return {
            title: "",
            message: "",
            resolve: null,
            reject: null,
            showModal: false,
        }
    },
    methods: {
        show(title, message) {
            const dialog = this;
            this.title = title;
            this.message = message;
            return new Promise((resolve, reject) => {
                dialog.showModal = true;
                dialog.resolve = resolve;
                dialog.reject = reject;
            });
        },
        ok() {
            this.showModal = false;
            this.resolve();
        },
        cancel() {
            this.showModal = false;
            this.reject();
        },
    },
}