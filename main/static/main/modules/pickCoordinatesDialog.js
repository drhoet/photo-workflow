import { nextTick } from 'vue';

export default {
    template: `
        <modal v-if="showModal" @show="onShow" @ok="updateTrackIds" @cancel="closeModal" :okButtonDisabled="!coordinatesChosen" id="pick-coordinates-modal">
            <template v-slot:header>
                <h3>Select a point on the map</h3>
            </template>
            <template v-slot:body>
                <div id="pick-coordinates-map" class="leaflet-map"></div>
                <div id="pick-coordinates-info">
                    <label for="overwrite">
                        <input type="checkbox" id="overwrite" v-model="overwrite" />
                        Overwrite existing coordinates
                    </label>
                    <span class="latlng">{{selectedCoordinatesDisplayString}}</span>
                </div>
            </template>
        </modal>
    `,
    props: ['showModal', 'coordinates'],
    emits: ['update:showModal', 'update:coordinates'],
    data() {
        return {
            selectedCoordinates: null,
            map: null,
            marker: null,
            overwrite: false,
        }
    },
    computed: {
        coordinatesChosen() {
            return this.selectedCoordinates !== null;
        },
        selectedCoordinatesDisplayString() {
            if(this.selectedCoordinates) {
                return `lat: ${this.selectedCoordinates[0].toFixed(5)} lon: ${this.selectedCoordinates[1].toFixed(5)}`
            } else {
                return "";
            }
        }
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        updateTrackIds() {
            this.$emit('update:coordinates', { lat: this.selectedCoordinates[0], lon: this.selectedCoordinates[1], overwrite: this.overwrite });
            this.closeModal();
        },
        onMapClick(event) {
            if(!this.marker) {
                this.marker = L.marker(event.latlng, {draggable: true}).addTo(this.map);
                this.marker.on('move', this.onMarkerPositionUpdated);
                this.marker.on('drag', this.onMarkerPositionUpdated);
            } else {
                this.marker.setLatLng(event.latlng);
            }
            this.onMarkerPositionUpdated(event);
        },
        onMarkerPositionUpdated(event) {
            this.selectedCoordinates = [event.latlng.lat, event.latlng.lng];
        },
        onShow() {
            this.selectedCoordinates = null;
            nextTick(() => {
                this.map = L.map('pick-coordinates-map').setView([51.172276, 4.392477], 4);
                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(this.map);
                this.map.on('click', this.onMapClick);
            });
            return;
        }
    }
}