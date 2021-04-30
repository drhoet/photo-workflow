export default {
    template: `
        <router-link :to="{ name: 'directory-detail-view', params: { id: item.id }}" class="item"><i class="mdi mdi-folder"></i><span class="label">{{ item.path }}</span></router-link>
    `,
    props: ['item']
}