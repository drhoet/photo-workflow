import { parseResponse, UiError } from "./errorHandler.js";
import { nextTick } from 'vue';

export default {
    // remark: we cannot use v-model:showModal below, because that will expand to something like @update:showModal="showModal = false",
    // attempting to update the prop showModal.
    template: `
        <modal :showModal="showModal" @update:showModal="closeModal" @ok="updateTrackIds" :okButtonDisabled="!trackIdsChosen" id="geotag-modal">
            <template v-slot:header>
                <h3>Select tracks to be used for geotagging</h3>
            </template>
            <template v-slot:body>
                <div id="track-maps">
                    <div v-for="track in tracks" class="track">
                        <div  :id="'map-track-' + track.id" class="leaflet-map"></div>
                        <label :for="'select-track-' + track.id">
                            <input type="checkbox" :id="'select-track-' + track.id" :value="track.id" v-model="selectedTrackIds" />
                            <span>{{track.display_name}}</span>
                        </label>
                    </div>
                </div>
                <label for="overwrite">
                    <input type="checkbox" id="overwrite" v-model="overwrite" />
                    Overwrite existing coordinates
                </label>
            </template>
        </modal>
    `,
    props: ['showModal', 'directory'],
    emits: ['update:showModal', 'update:trackIds'],
    data() {
        return {
            selectedTrackIds: [],
            tracks: [],
            overwrite: false,
            loading: false,
        }
    },
    computed: {
        trackIdsChosen() {
            return this.selectedTrackIds.length > 0;
        }
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        updateTrackIds() {
            this.$emit('update:trackIds', { trackIds: this.selectedTrackIds, overwrite: this.overwrite });
            this.closeModal();
        },
        fetchTracks() {
            return fetch(`/main/api/dir/${this.directory.id}/tracks`, { method: 'get', headers: { 'content-type': 'application/json' } })
                .then(res => parseResponse(res, `Could not load tracks`, false))
                .then(json => {
                    if(!json || json.length <= 0) {
                        throw new UiError('No track files found in this directory.', false);
                    }
                    this.tracks = json;
                    return nextTick; // this async method is resolved when vue has done the next DOM update. That update should have created the map-divs.
                })
                .then(() => {
                    for(let track of this.tracks) {
                        let map = L.map(`map-track-${track.id}`);
                        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap'
                        }).addTo(map);
                        let boundingBox;
                        for(let section of track.data.sections) {
                            let latlngs = [];
                            for(let gpsFix of section.gps_fixes) {
                                latlngs.push([gpsFix.coordinate.latitude, gpsFix.coordinate.longitude]);
                            }
                            let polyline = L.polyline(latlngs).addTo(map);
                            if(boundingBox) {
                                boundingBox.extend(polyline.getBounds());
                            } else {
                                boundingBox = polyline.getBounds();
                            }
                        }
                        map.fitBounds(boundingBox);
                    }
                })
                .catch((err) => {
                    this.closeModal();
                    throw err;
                })
        }
    },
    watch: {
        showModal: function(newVal, oldVal) {
            if(newVal) {
                this.selectedTrackIds = [];
                return this.fetchTracks();
            }
        }
    }
}