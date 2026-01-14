// شركة معلومات المتجر
const CompanyInfo = {
  name: 'أولاد الخواص',
  arabicName: 'أولاد الخواص',
  englishName: 'Owlad Al-Khawas',
  
  // معلومات الإدارة
  management: {
    principal: 'المعلم صبري الخواص',
    coOwner: 'الولادة',
    fullManagement: 'المعلم صبري الخواص و الولادة'
  },
  
  // معلومات الاتصال
  contact: {
    phone1: '01154031550',
    phone2: '01500272762',
    phones: ['01154031550', '01500272762']
  },
  
  // الفئة
  category: 'السباكة والأدوات',
  type: 'متجر سباكة',
  
  // الحصول على جميع معلومات الشركة
  getInfo: function() {
    return {
      name: this.name,
      arabicName: this.arabicName,
      englishName: this.englishName,
      management: this.management.fullManagement,
      phone1: this.contact.phone1,
      phone2: this.contact.phone2,
      category: this.category,
      type: this.type
    };
  },
  
  // الحصول على معلومات الاتصال
  getContactInfo: function() {
    return `${this.contact.phone1} / ${this.contact.phone2}`;
  },
  
  // الحصول على معلومات الإدارة
  getManagementInfo: function() {
    return this.management.fullManagement;
  },
  
  // الحصول على قائمة الهواتف
  getPhones: function() {
    return this.contact.phones;
  }
};

// تصدير للاستخدام العام
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CompanyInfo;
}
