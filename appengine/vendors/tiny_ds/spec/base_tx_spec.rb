require File.dirname(__FILE__) + '/spec_helper'

class User < TinyDS::Base
  property :nickname, :string
  property :money,    :integer
  def apply_recv_money(amount)
    self.money += amount
    return [self]
  end
end

describe "BaseTx" do
  before :all do
    #AppEngine::Testing.install_test_env
    AppEngine::Testing.install_test_datastore
  end

  describe "should move money A to B" do
    before :each do
      User.destroy_all
      TinyDS::BaseTx::SrcJournal.destroy_all
      TinyDS::BaseTx::DestJournal.destroy_all

      @userA = User.create(:nickname=>"userA", :money=>10000)
      @userB = User.create(:nickname=>"userB", :money=>10000)
      @amount = 500

      User.count.should                         == 2
      TinyDS::BaseTx::SrcJournal.count.should  == 0
      TinyDS::BaseTx::DestJournal.count.should == 0
    end

    describe "create a journal" do
      before :each do
        @journal = nil
        TinyDS.tx do
          @userA = @userA.reget
          @userA.money -= @amount
          @journal = TinyDS::BaseTx.build_journal(
            @userA,
            {:class=>User, :key=>@userB.key}, # @userB,
            :apply_recv_money,
            @amount
          )
          TinyDS.batch_save([@userA, @journal])
        end

        @userA.reget.money.should        ==  9500
        @userB.reget.money.should        == 10000
        @journal.reget.args.size.should  ==     1
        @journal.reget.args[0].should    ==   500
        @journal.reget.status.should     == "created"
        @journal.reget.created_at.should_not be_nil
        TinyDS::BaseTx::SrcJournal.count.should  == 1
        TinyDS::BaseTx::DestJournal.count.should == 0

        TinyDS::BaseTx::SrcJournal.query.each{|sj|
          sj.is_created_src_key.should_not  be_nil
          sj.is_created_dest_key.should_not be_nil
        }
      end

      def common_specs_for_after_apply
        @userA.reget.money.should        ==  9500
        @userB.reget.money.should        == 10500
        @journal.reget.status.should     == "done"
        TinyDS::BaseTx::SrcJournal.count.should  == 1
        TinyDS::BaseTx::DestJournal.count.should == 1

        TinyDS::BaseTx.apply(@journal.key)

        @userA.reget.money.should        ==  9500
        @userB.reget.money.should        == 10500

        TinyDS::BaseTx::SrcJournal.query.each{|sj|
          sj.is_created_src_key.should  be_nil
          sj.is_created_dest_key.should be_nil
        }
      end

      it "apply by instance" do
        TinyDS::BaseTx.apply(@journal)
        common_specs_for_after_apply
      end
      it "apply by key" do
        TinyDS::BaseTx.apply(@journal.key)
        common_specs_for_after_apply
      end
      it "apply_pendings" do
        TinyDS::BaseTx.apply_pendings
        common_specs_for_after_apply
      end
      it "apply by query_created_by_src_key" do
        q = TinyDS::BaseTx::SrcJournal.query_created_by_src_key(@userA.key)
        q.count.should == 1
        q.each do |sj|
          TinyDS::BaseTx.apply(sj)
        end
        common_specs_for_after_apply
        q.count.should == 0
      end
      it "apply by query_created_by_dest_key" do
        q = TinyDS::BaseTx::SrcJournal.query_created_by_dest_key(@userB.key)
        q.count.should == 1
        q.each do |sj|
          TinyDS::BaseTx.apply(sj)
        end
        common_specs_for_after_apply
        q.count.should == 0
      end

      def common_specs_for_after_apply_skip_set_done
        @userA.reget.money.should        ==  9500
        @userB.reget.money.should        == 10500
        @journal.reget.status.should     == "created"
        TinyDS::BaseTx::SrcJournal.count.should  == 1
        TinyDS::BaseTx::DestJournal.count.should == 1

        TinyDS::BaseTx.apply_pendings

        @journal.reget.status.should     == "done"
        @userA.reget.money.should        ==  9500
        @userB.reget.money.should        == 10500

        TinyDS::BaseTx::SrcJournal.query.each{|sj|
          sj.is_created_src_key.should  be_nil
          sj.is_created_dest_key.should be_nil
        }
      end
      it "apply by instance skip_set_done" do
        TinyDS::BaseTx.apply(@journal, :skip_set_done=>true)
        common_specs_for_after_apply_skip_set_done
      end
      it "apply by key skip_set_done" do
        TinyDS::BaseTx.apply(@journal.key, :skip_set_done=>true)
        common_specs_for_after_apply_skip_set_done
      end
    end
  end

  describe "should move money AtoB and AtoC"
end
