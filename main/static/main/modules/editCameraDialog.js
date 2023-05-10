export default {
    template: `
        <modal v-if="showModal" @show="onShow" @ok="updateCamera" @cancel="closeModal" :okButtonDisabled="!cameraChosen" id="edit-camera-modal">
            <template v-slot:header>
                <h3>Edit camera</h3>
            </template>
            <template v-slot:body>
                <label v-for="camera in cameras">
                    <input type="radio" :id="'camera-'+camera.id" name="camera" :value="camera.id" v-model="selectedCameraId"/>
                    {{ camera.make }} {{ camera.model }} {{ camera.serial }}
                </label>
            </template>
        </modal>
    `,
    inject: ['backendService'],
    props: ['showModal', 'modelValue'],
    emits: ['update:showModal', 'update:modelValue'],
    data() {
        return {
            selectedCameraId: this.modelValue,
            cameras: [],
        }
    },
    computed: {
        cameraChosen() {
            return this.selectedCameraId > 0;
        },
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        updateCamera() {
            this.$emit('update:modelValue', this.selectedCameraId);
            this.closeModal();
        },
        fetchCameras() {
            return fetch('/main/api/camera', { method: 'get', headers: { 'content-type': 'application/json' } })
                .then(res => this.backendService.parseResponse(res, `Could not load cameras`, false))
                .then(json => {
                    this.cameras = json;
                }).catch((err) => {
                    this.closeModal();
                    throw err;
                })
        },
        onShow() {
            this.selectedCameraId = this.modelValue;
            return this.fetchCameras();
        },
        onKeyDown(e) {
            if(e.key == 'ArrowDown') {
                if(this.cameraChosen) {
                    let currentIdx = this.cameras.findIndex(el => el.id === this.selectedCameraId);
                    let nextIdx = currentIdx < this.cameras.length - 1 ? currentIdx + 1 : 0;
                    this.selectedCameraId = this.cameras[nextIdx].id;
                } else {
                    this.selectedCameraId = this.cameras[0].id;
                }
                e.preventDefault();
            }
            if(e.key == 'ArrowUp') {
                if(this.cameraChosen) {
                    let currentIdx = this.cameras.findIndex(el => el.id === this.selectedCameraId);
                    let previousIdx = currentIdx > 0 ? currentIdx - 1 : this.cameras.length - 1;
                    this.selectedCameraId = this.cameras[previousIdx].id;
                } else {
                    this.selectedCameraId = this.cameras[this.authors.length - 1].id;
                }
                e.preventDefault();
            }
        }

    }
}