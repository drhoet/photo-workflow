import { UiError } from "./errorHandler.js";
import { nextTick, inject } from 'vue';
import { DateTime } from 'luxon';

export default {
    template: `
        <modal v-if="showModal" @show="onShow" @ok="updateTrackIds" @cancel="closeModal" :okButtonDisabled="!trackIdsChosen" :loading="loading" id="geotag-modal">
            <template v-slot:header>
                <h3>Select tracks to be used for geotagging</h3>
            </template>
            <template v-slot:body>
                <div id="track-maps">
                    <div v-for="track in tracks" class="track">
                        <div  :id="'map-track-' + track.id" class="leaflet-map"></div>
                        <div class="bar">
                            <label :for="'select-track-' + track.id">
                                <input type="checkbox" :id="'select-track-' + track.id" :value="track.id" v-model="selectedTrackIds" />
                                <span>{{track.display_name}}</span>
                            </label>
                            <div class="cursor-slider">
                                <button @click="slideOneLeft(track)"><span class="mdi mdi-chevron-left"></span></button>
                                <input type="range" :min="0" :max="track.uidata.flattenedData.length - 1" v-model.number="track.uidata.cursor" @input="cursorUpdated(track)" />
                                <button @click="slideOneRight(track)"><span class="mdi mdi-chevron-right"></span></button>
                            </div>
                        </div>
                    </div>
                </div>
                <label for="overwrite">
                    <input type="checkbox" id="overwrite" v-model="overwrite" />
                    Overwrite existing coordinates
                </label>
            </template>
        </modal>
    `,
    inject: ['backendService', 'settings'],
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
        slideOneLeft(track) {
            if(track.uidata.cursor > 0) {
                track.uidata.cursor -= 1;
                this.cursorUpdated(track);
            }
        },
        slideOneRight(track) {
            if(track.uidata.cursor < track.uidata.flattenedData.length - 1) {
                track.uidata.cursor += 1;
                this.cursorUpdated(track);
            }
        },
        cursorUpdated(track) {
            let datapoint = track.uidata.flattenedData[track.uidata.cursor];
            track.uidata.cursorMarker
                .setLatLng([datapoint.coordinate.latitude, datapoint.coordinate.longitude])
                .setContent(this.formatUtcDateTime(datapoint.timestamp));
        },
        formatUtcDateTime(s) {
            return DateTime.fromSeconds(s, {zone: 'utc'}).setLocale(this.settings.dateTimeLocale).toLocaleString({ dateStyle: 'medium', timeStyle: 'long'});
        },
        closeModal() {
            this.$emit('update:showModal', false);
        },
        updateTrackIds() {
            this.$emit('update:trackIds', { trackIds: this.selectedTrackIds, overwrite: this.overwrite });
            this.closeModal();
        },
        fetchTracks() {
            return fetch(`/main/api/dir/${this.directory.id}/tracks`, { method: 'get', headers: { 'content-type': 'application/json' } })
                .then(res => this.backendService.parseResponse(res, `Could not load tracks`, false))
                .then(json => {
                    if(!json || json.length <= 0) {
                        throw new UiError('No track files found in this directory.', false);
                    }
                    for(let track of json) {
                        track.uidata = {}; // HACK: bit ugly to enrich this object here, but I don't want to copy....
                        track.uidata.flattenedData = []; 
                        for(let section of track.data.sections) {
                            for(let gpsFix of section.gps_fixes) {
                                track.uidata.flattenedData.push(gpsFix);
                            }
                        }
                        track.uidata.cursor = 0;
                    }
                    this.tracks = json;
                    this.loading = false;
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
                        track.uidata.cursorMarker = L.tooltip().setLatLng([0, 0]).addTo(map);
                        map.fitBounds(boundingBox);
                    }
                })
                .catch((err) => {
                    this.closeModal();
                    throw err;
                })
        },
        onShow() {
            this.loading = true;
            this.selectedTrackIds = [];
            return this.fetchTracks();
        }
    }
}