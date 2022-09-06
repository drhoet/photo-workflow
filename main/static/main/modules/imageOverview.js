import { inject } from 'vue';
import { DateTime } from 'luxon';

export default {
    template: `
        <a href="#" @click.prevent.capture.stop="onThumbnailClicked">
            <img class="thumbnail" :src="item.thumbnail"/>
            <div class="item-id">
                <i v-if="hasAttachments" class="mdi mdi-paperclip tooltip-symbol">
                    <ul v-if="hasAttachments" class="tooltip-contents">
                        <li v-for="att in item.attachments">{{att.name}}</li>
                    </ul>
                </i>
                <span>{{item.name}}</span>
                <i v-if="item.coordinates" class="mdi mdi-earth"></i>
            </div>
        </a>
        <ul v-if="item.errors" class="errors">
            <li v-for="err in item.errors" class="mdi mdi-alert">{{err}}</li>
        </ul>
        <ul class="properties">
            <li v-if="item.author" class="mdi mdi-account">{{item.author.name}}</li>
            <li class="mdi mdi-clock-outline">{{formattedDate}}</li>
        </ul>
    `,
    props: ['item'],
    emits: ['item:open'],
    setup() {
        let settings = inject('settings');
        return {
            settings: settings
        };
    },
    computed: {
        formattedDate() {
            if(this.item.date_time) {
                const parsed = DateTime.fromISO(this.item.date_time, {setZone: true});
                if(this.item.date_time.length > 19) {
                    return parsed.setLocale(this.settings.dateTimeLocale).toLocaleString({ dateStyle: 'medium', timeStyle: 'long'});
                } else {
                    // luxon will assume the local time zone here, we don't want to print that, so we use the 'medium' timeStyle
                    return parsed.setLocale(this.settings.dateTimeLocale).toLocaleString({ dateStyle: 'medium', timeStyle: 'medium'});
                }
            } else {
                return "--";
            }
        },
        hasAttachments() {
            return this.item.attachments.length > 0;
        }
    },
    methods: {
        onThumbnailClicked() {
            this.$emit('item:open');
        }
    }
}