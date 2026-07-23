export default {
  name: 'guildMemberUpdate',
  async execute(oldMember: any, newMember: any, { services }: any): Promise<void> {
    await services.staffListService.handleRoleChange(oldMember, newMember);
  }
};
