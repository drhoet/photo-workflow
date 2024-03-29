import { DateTime, FixedOffsetZone } from "luxon";

export default {
    template: `
        <modal v-if="showModal" @show="onShow" @ok="updateTimezone" @cancel="closeModal" id="edit-timezone-modal">
            <template v-slot:header>
                <h3>Edit timezone</h3>
            </template>
            <template v-slot:body>
                <label>
                    <input type="radio" value="overwrite" v-model="mode"/>
                    Overwrite timezone<template v-if="multipleItems"> in all images</template>
                </label>
                <label>
                    <input type="radio" value="translate" v-model="mode" />
                    Translate <template v-if="multipleItems">all timezones</template><template v-else>timezone</template> with a fixed amount
                </label>
                <label>
                    <input type="radio" value="use-named-zone" v-model="mode" />
                    Take the offset of a named timezone at the moment <template v-if="multipleItems">each</template><template v-else>the</template> image was taken
                </label>

                <span v-if="multipleActualTimezones" id="multipleValuesWarning">
                    Files in this directory do not all have the same timezone. These are the timezones that appear:
                    <table>
                        <tr>
                            <th>Timezone</th>
                            <th>Count</th>
                            <th>New timezone</th>
                        </tr>
                        <tr v-for="(cnt, tz) in actualTimezones">
                            <td>{{ formatTimezone(tz) }}</td>
                            <td>{{ cnt }}</td>
                            <td v-if="mode == 'overwrite'">{{ formatTimezone(value) }}</td>
                            <td v-if="mode == 'translate'">{{ formatTimezone(parseInt(tz) + value) }}</td>
                            <td v-if="mode == 'use-named-zone'">Depends on image date/time</td>
                        </tr>
                    </table>
                </span>
                <span v-if="mode == 'overwrite' || mode == 'translate'">
                    <label v-if="mode == 'overwrite'">New timezone:</label>
                    <label v-if="mode == 'translate'">Adjust timezone by:</label>
                    <span class="selector">
                        <button @click="decreaseValueByHour">--</button>
                        <button @click="decreaseValue">-</button>
                        <span>{{ formatTimezone(value) }}</span>
                        <button @click="increaseValue">+</button>
                        <button @click="increaseValueByHour">++</button>
                    </span>
                </span>
                <span v-if="mode == 'use-named-zone'">
                    <label>Select named zone:</label>
                    <select v-model="namedZone">
                        <option v-for="tz in allTimeZones">{{tz}}</option>
                    </select>
                </span>
            </template>
        </modal>
    `,
    props: ['showModal', 'items'],
    emits: ['update:showModal', 'update:timezone'],
    data() {
        return {
            value: 0,
            actualTimezones: {},
            namedZone: "Europe/Brussels",
            mode: 'overwrite'
        }
    },
    computed: {
        multipleActualTimezones() {
            return Object.entries(this.actualTimezones).length > 1;
        },
        multipleItems() {
            return this.items.length > 1;
        },
        allTimeZones() {
            return Intl.supportedValuesOf('timeZone');
        }
    },
    methods: {
        closeModal() {
            this.$emit('update:showModal', false);
        },
        updateTimezone() {
            let supported_items = this.items
                .filter(item => this.mode === 'overwrite' 
                    || (this.mode === 'translate' && this.extractTimezone(item.date_time) !== 'N/A')
                    || this.mode == 'use-named-zone');

            this.$emit('update:timezone', {
                mode: this.mode,
                value: this.value,
                namedZone: this.namedZone,
                items: supported_items,
            });
            this.closeModal();
        },
        increaseValue() {
            this.value += 15;
        },
        increaseValueByHour() {
            this.value += 60;
        },
        decreaseValue() {
            this.value -= 15;
        },
        decreaseValueByHour() {
            this.value -= 60;
        },
        formatTimezone(tz) {
            if(tz === 'N/A') {
                return 'N/A';
            } else {
                return FixedOffsetZone.instance(tz).formatOffset(0, 'short');
            }
        },
        extractTimezone(dt) {
            let key = 'N/A';
            if(dt) {
                const parsed = DateTime.fromISO(dt, {setZone: true});
                if (dt.length > 19) {
                    key = parsed.offset;
                }
            }
            return key;
        },
        extractTimezones() {
            let tzMap = {};
            this.items.forEach(it => {
                let key = this.extractTimezone(it.date_time);
                if (key in tzMap) {
                    tzMap[key] = tzMap[key] + 1;
                } else {
                    tzMap[key] = 1;
                }
            });
            let selectedTz = -1;
            let maxCnt = -1;
            for(const [tz, cnt] of Object.entries(tzMap)) {
                if(cnt > maxCnt) {
                    maxCnt = cnt;
                    selectedTz = tz;
                }
            }

            this.actualTimezones = tzMap;
            this.value = selectedTz == 'N/A' ? 0 : parseInt(selectedTz);
        },
        onShow() {
            return this.extractTimezones();
        },
        onKeyDown(e) {
            const options = ['overwrite', 'translate', 'use-named-zone'];
            if(e.key == 'ArrowDown') {
                let currentIdx = options.findIndex(el => el === this.mode);
                let nextIdx = currentIdx < options.length - 1 ? currentIdx + 1 : 0;
                this.mode = options[nextIdx];
                e.preventDefault();
            }
            if(e.key == 'ArrowUp') {
                let currentIdx = options.findIndex(el => el === this.mode);
                let previousIdx = currentIdx > 0 ? currentIdx - 1 : options.length - 1;
                this.mode = options[previousIdx];
                e.preventDefault();
            }
        }

    }
}