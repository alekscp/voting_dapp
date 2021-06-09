const Voting = artifacts.require('Voting');
const { time } = require('@openzeppelin/test-helpers');

contract('Voting', accounts => {
  this.electionName = web3.utils.toHex('test election')
  this.electionProposal = 'Test proposal'
  this.registrationDeadline = 140
  this.votingDeadline = 280
  this.endingTime = 560

  const deploy = async () => {
    instance = await Voting.new();
  }

  const createElection = async (args) => {
    args = args || {}
    const en = args.electionName || this.electionName
    const ep = args.electionProposal || this.electionProposal
    const rd = args.registrationDeadline || this.registrationDeadline
    const vd = args.votingDeadline || this.votingDeadline
    const et = args.endingTime || this.endingTime

    await instance.newElection(en, ep, rd, vd, et, { from: accounts[0] })
  }

  describe('newElection', async () => {
    beforeEach(async () => {
      await deploy()
      await createElection();
      originalBlock = await time.latest()
    });

    it('creates an election', async () => {
      const election = await instance.elections(0);
      assert.exists(election.name);
    });

    it('sets proposal', async () => {
      const election = await instance.elections(0);
      const proposal = await election.proposal;
      assert.equal(this.electionProposal, proposal);
    });

    it('sets registrationDeadline relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      const registrationDeadline = await election.registrationDeadline.toNumber();
      assert.equal(registrationDeadline, originalBlock.toNumber() + this.registrationDeadline);
    });

    it('sets votingDeadline relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      const votingDeadline = election.votingDeadline.toNumber()
      assert.strictEqual(votingDeadline, originalBlock.toNumber() + this.votingDeadline);
    });

    it('sets endingTime relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      const endingTime = election.endingTime.toNumber()
      assert.strictEqual(endingTime, originalBlock.toNumber() + this.endingTime);
    });

    it('should NOT create an election if name is already taken', async () => {
      try {
        await createElection()
      } catch (error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Election with that name already exists.');
    });
  });

  describe('registerCandidate', async () => {
    beforeEach(async () => {
      await deploy()
      await createElection()
    })

    it('registers a candidate to a given election', async () => {
      const candidateName = web3.utils.toHex('Bob');
      await instance.registerCandidate(this.electionName, candidateName, { from: accounts[0] });
      const election = await instance.elections(0);
      const candidate = await instance.candidates(accounts[0]);

      assert.isOk(candidate);
      assert.strictEqual(web3.utils.hexToUtf8(candidate.electionName), web3.utils.hexToUtf8(this.electionName));
    });

    it('errors if the election does not exist', async () => {
      const otherElectionName = web3.utils.toHex('other');
      const candidateName = web3.utils.toHex('Bob');

      try {
        await instance.registerCandidate(otherElectionName, candidateName, { from: accounts[0] });
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'No election with that name found.');
    });

    it('errors if the registration period has ended', async () => {
      await time.increase(this.registrationDeadline);

      const candidateName = web3.utils.toHex('Bob');

      try {
        await instance.registerCandidate(this.electionName, candidateName, { from: accounts[0] });
      } catch(error) {
        err = error
      };

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Registration period has ended.');
    });

    it('errors if the candidate has already registered to that election', async () => {
      const electionName = web3.utils.toHex('other test');
      const candidateName = web3.utils.toHex('bob');

      await createElection({electionName: electionName})
      await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });

      try {
        await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });
      } catch(error) {
        err = error
      };

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Candidate already registered for that election.');
    });
  });

  describe('getElectionCandidates', () => {
    beforeEach(async () => {
      await deploy()
      await createElection()
      await instance.registerCandidate(this.electionName, web3.utils.toHex('Candidate 1'), { from: accounts[0] })
      await instance.registerCandidate(this.electionName, web3.utils.toHex('Candidate 2'), { from: accounts[1] })
      await instance.registerCandidate(this.electionName, web3.utils.toHex('Candidate 3'), { from: accounts[2] })
    })

    it('returns an array containing all the candidates', async () => {
      const candidates = await instance.getElectionCandidates(this.electionName)
      assert(candidates.length >= 3)
    })
  })

  describe('removeCandidate', () => {
    beforeEach(async () => {
      await deploy()
      await createElection()
    })

    it('removes a candidate from a given election', async () => {
      const candidateAddress = accounts[0]
      const candidateName = web3.utils.toHex('Candidate 1')

      await instance.registerCandidate(this.electionName, candidateName, { from: candidateAddress });
      await instance.removeCandidate(this.electionName, candidateAddress)

      const candidate = await instance.candidates(candidateAddress)

      assert.equal(candidate.candidateAddress, 0)
    })

    it('errors if another account tries to remove a candidate', async () => {
      const candidateAddress = accounts[0]
      const candidateName = web3.utils.toHex('Candidate 1')
      const nonCandidateAddress = accounts[1]

      await instance.registerCandidate(this.electionName, candidateName, { from: candidateAddress });

      try {
        await instance.removeCandidate(this.electionName, nonCandidateAddress)
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Only candidate can remove himself/herself from an election.');
    })

    it('errors if that candidate is not found in the election', async () => {
      const candidateAddress = accounts[0]

      try {
        await instance.removeCandidate(this.electionName, candidateAddress, { from: candidateAddress })
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'This candidate is not registered in that election.');
    })
  })

  describe('vote', () => {
    beforeEach(async () => {
      await deploy()
      const candidateName1 = web3.utils.toHex('Bob');
      const candidateName2 = web3.utils.toHex('Bob');
      const candidateName3 = web3.utils.toHex('Bob');

      [candidate1, candidate2, candidate3, voter1, voter2, voter3, voter4] = accounts
      await createElection()

      await instance.registerCandidate(this.electionName, candidateName1, { from: candidate1 })
      await instance.registerCandidate(this.electionName, candidateName2, { from: candidate2 })
      await instance.registerCandidate(this.electionName, candidateName3, { from: candidate3 })
    })

    it('registers a vote', async () => {
      const vote = await instance.vote(this.electionName, candidate1, { from: voter1 })
      assert.isOk(vote)
    })

    it('bumps the candidate\'s vote count by 1 for every vote registered', async () => {
      const assertVote = async (candidate, voter, expectedResult) => {
        await instance.vote(this.electionName, candidate, { from: voter })
        let candidatee = await instance.candidates(candidate)
        assert.equal(candidatee.votes.toNumber(), expectedResult)
      }

      await assertVote(candidate1, voter1, 1)
      await assertVote(candidate1, voter2, 2)
      await assertVote(candidate1, voter3, 3)
      await assertVote(candidate1, voter4, 4)
    })

    it('errors if election has already ended', async () => {
      await time.increase(this.endingTime)

      try {
        await instance.vote(this.electionName, candidate1, { from: voter1 })
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Election has already ended.');
    })

    it('errors if voting period is over', async () => {
      await time.increase(this.votingDeadline)

      try {
        await instance.vote(this.electionName, candidate1, { from: voter1 })
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Voting period is over.');
    })

    it('errors if registration period is still happening', async () => {
      await time.increase(this.registrationDeadline + 1)

      try {
        await instance.vote(this.electionName, candidate1, { from: voter1 })
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Candidates are still registering.');
    })
  })
});
