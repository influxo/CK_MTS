'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('beneficiaries', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      pseudonym: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'active',
      },
      firstNameEnc: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      lastNameEnc: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      dobEnc: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      nationalIdEnc: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      phoneEnc: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      emailEnc: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      addressEnc: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
    });

    await queryInterface.addIndex('beneficiaries', ['status']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('beneficiaries');
  }
};
