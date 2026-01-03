● I need to add logic to remove the user from their existing team before adding them to the new team. Let me update the acceptInvitation method:

● Update(apps/api/app/controllers/teams_controller.ts)
  ⎿  Added 3 lines
      788        })
      789      }
      790
      791 +    // Remove user from any existing team memberships (they are not an owner at this point)
      792 +    await TeamMember.query().where('userId', user.id).delete()
      793 +
      794      // Add user to team
      795      await TeamMember.create({
      796        userId: user.id,

● Now let me also fix the addMember method to remove users from their existing team:

● Read(apps/api/app/controllers/teams_controller.ts)
  ⎿  Read 40 lines

● Update(apps/api/app/controllers/teams_controller.ts)
  ⎿  Added 3 lines
      294        })
      295      }
      296
      297 +    // Remove user from any existing team memberships (they are not an owner at this point)
      298 +    await TeamMember.query().where('userId', newMember.id).delete()
      299 +
      300      await TeamMember.create({
      301        userId: newMember.id,
      302        teamId: Number(teamId),

● Now let me investigate the 500 error on team creation. Let me check the teams controller store method and look for potential issues:


DO NOT DO THAT, revert it, it's a regression, the correct fix is to remove that test. `I need to add logic to
  remove the user from their existing team before adding them to the new team. Let me update the acceptInvitation
  method:` and all other failing test that verify a user is part of a single team. A user can now be part of
  multiple teams.