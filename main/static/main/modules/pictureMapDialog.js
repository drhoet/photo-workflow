import { nextTick } from 'vue';

export default {
    template: `
        <modal :showModal="showModal" @ok="closeModal" @cancel="closeModal" :cancellable="false" id="picture-map-modal">
            <template v-slot:header>
                <h3>Images in this directory</h3>
            </template>
            <template v-slot:body>
                <div id="picture-map" class="leaflet-map"></div>
            </template>
        </modal>
    `,
    props: ['showModal', 'items'],
    emits: ['update:showModal'],
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
    },
    watch: {
        showModal: function(newVal, oldVal) {
            if(newVal) {
                nextTick(() => {
                    let map = L.map('picture-map').setView([51.172276, 4.392477], 4);
                    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap'
                    }).addTo(map);
                    let allMarkers = [];
                    for(let item of this.items) {
                        if(item.coordinates) {
                            let marker = new L.marker([item.coordinates.lat, item.coordinates.lon]).bindPopup(`<img src="${item.thumbnail}"/>`, {closeButton: false}).addTo(map);
                            allMarkers.push(marker);
                        }
                    }
                    let allMarkersFeatureGroup = new L.featureGroup(allMarkers);
                    map.fitBounds(allMarkersFeatureGroup.getBounds());
                });
                return;
            }
        }
    }
}