import IndexView from './modules/indexView.js'
import DirectoryLink from './modules/directoryLink.js'
import DirectoryDetailView from './modules/directoryDetailView.js'
import ImageDetailView from './modules/imageDetailView.js'
import ModalDialog from './modules/modalDialog.js'
import EditAuthorDialog from './modules/editAuthorDialog.js'
import ErrorHandler from './modules/errorHandler.js'
import EditTimezoneDialog from './modules/editTimezoneDialog.js'
import ImageOverview from './modules/imageOverview.js'

const About = { template: '<div>About</div>' }

const Breadcrumbs = {
    template: "#breadcrumbs-template",
    props: ['items']
}

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes: [
        { name: 'home', path: '/', component: IndexView },
        { path: '/about', component: About },
        { name: 'directory-detail-view', path: '/dir/:id/detail', component: DirectoryDetailView },
        { name: 'image-detail-view', path: '/img/:id/detail', component: ImageDetailView }
    ],
});

const app = Vue.createApp({});

app.component('directory-link', DirectoryLink);
app.component('image-overview', ImageOverview);
app.component('modal', ModalDialog);
app.component('breadcrumbs', Breadcrumbs);
app.component('edit-author-dialog', EditAuthorDialog);
app.component('error-handler', ErrorHandler);
app.component('edit-timezone-dialog', EditTimezoneDialog);

app.use(router);
app.mount('#app');

