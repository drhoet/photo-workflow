export default {
    template: `
        <router-link :to="{ name: 'image-detail-view', params: { id: item.id }}">
            <img class="thumbnail" :src="item.thumbnail" />
            <div class="item-id">
                <i class="mdi mdi-information-outline"></i>
                <span>{{item.name}}</span>
                <i class="mdi mdi-earth"></i>
            </div>
        </router-link>
        <div class="information">
            <span>Attachments:</span>
            <ul v-if="item.attachments" class="attachments">
                <li v-for="att in item.attachments">{{att.name}}</li>
            </ul>
        </div>
        <ul v-if="item.errors" class="errors">
            <li v-for="err in item.errors" class="mdi mdi-alert">{{err}}</li>
        </ul>
        <ul class="properties">
            <li v-if="item.author" class="mdi mdi-account">{{item.author.name}}</li>
            <li class="mdi mdi-clock-outline">{{formattedDate}}</li>
            <li class="mdi mdi-clock-outline">{{item.date_time}}</li>
        </ul>
    `,
    props: ['item'],
    computed: {
        formattedDate() {
            if(this.item.date_time) {
                const parsed = luxon.DateTime.fromISO(this.item.date_time, {setZone: true});
                if(this.item.date_time.length > 19) {
                    return parsed.toLocaleString({ dateStyle: 'medium', timeStyle: 'long'});
                } else {
                    return parsed.toLocaleString({ dateStyle: 'medium', timeStyle: 'medium'}) + " (no offset information)";
                }
            } else {
                return "#no_value";
            }
        }
    }
}